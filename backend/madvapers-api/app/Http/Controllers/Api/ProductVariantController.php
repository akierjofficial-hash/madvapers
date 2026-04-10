<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Controllers\Api\Concerns\EnforcesBranchAccess;
use App\Models\ProductVariant;
use App\Models\Product;
use Illuminate\Http\Request;

use App\Models\Branch;
use App\Models\InventoryBalance;
use App\Models\StockLedger;
use App\Models\StockAdjustmentItem;
use App\Models\TransferItem;
use App\Models\PurchaseOrderItem;
use App\Models\PriceHistory;
use Illuminate\Support\Facades\DB;

class ProductVariantController extends Controller
{
    use EnforcesBranchAccess;

    public function index(Request $request)
    {
        $like = DB::getDriverName() === 'pgsql' ? 'ilike' : 'like';
        $request->validate([
            'branch_id' => ['nullable', 'integer', 'exists:branches,id'],
            'product_id' => ['nullable', 'integer', 'exists:products,id'],
            'search' => ['nullable', 'string', 'max:120'],
            'code' => ['nullable', 'string', 'max:120'],
            'include_inactive' => ['nullable', 'boolean'],
            'only_inactive' => ['nullable', 'boolean'],
            'per_page' => ['nullable', 'integer', 'min:1', 'max:500'],
        ]);

        $branchId = $request->filled('branch_id') ? (int) $request->input('branch_id') : null;
        $assignedBranchIds = null;

        if ($branchId !== null) {
            $this->enforceBranchAccessOrFail($request, $branchId);
        } elseif (!$this->isPrivilegedUser($request->user())) {
            $assignedBranchIds = $this->assignedBranchIds($request);
        }

        $q = ProductVariant::query()
            ->with(['product.brand', 'product.category'])
            ->withSum(
                [
                    'inventoryBalances as qty_on_hand' => static function ($sub) use ($branchId, $assignedBranchIds) {
                        if ($branchId !== null) {
                            $sub->where('branch_id', $branchId);
                            return;
                        }

                        if (!is_array($assignedBranchIds)) {
                            return;
                        }

                        if (empty($assignedBranchIds)) {
                            $sub->whereRaw('1 = 0');
                            return;
                        }

                        $sub->whereIn('branch_id', $assignedBranchIds);
                    },
                ],
                'qty_on_hand'
            )
            ->orderBy('id', 'desc');

        if ($request->filled('code')) {
            $code = trim((string) $request->input('code'));
            $q->where(function ($sub) use ($code) {
                $sub->where('barcode', $code)
                    ->orWhere('sku', $code);
            });
            $q->orderByRaw('CASE WHEN barcode = ? THEN 0 WHEN sku = ? THEN 1 ELSE 2 END', [$code, $code]);
        }

        if ($request->filled('search')) {
            $term = '%' . trim((string) $request->input('search')) . '%';
            $q->where(function ($sub) use ($term, $like) {
                $sub->where('sku', $like, $term)
                    ->orWhere('barcode', $like, $term)
                    ->orWhere('variant_name', $like, $term)
                    ->orWhere('flavor', $like, $term);
            });
        }

        if ($request->filled('product_id')) {
            $q->where('product_id', $request->integer('product_id'));
        }

        if ($request->boolean('only_inactive', false)) {
            $q->where(function ($inactiveQuery) {
                $inactiveQuery->where('is_active', false)
                    ->orWhereHas('product', function ($productQuery) {
                        $productQuery->where('is_active', false);
                    });
            });
        } elseif (!$request->boolean('include_inactive', false)) {
            $q->where('is_active', true)
                ->whereHas('product', function ($productQuery) {
                    $productQuery->where('is_active', true);
                });
        }

        $perPage = (int) $request->input('per_page', 20);
        if ($perPage <= 0) {
            $perPage = 20;
        }
        $perPage = min($perPage, 500);

        return $q->paginate($perPage);
    }

    public function store(Request $request)
    {
        $data = $request->validate([
            'product_id' => ['required', 'exists:products,id'],
            'sku' => ['required', 'string', 'max:64', 'unique:product_variants,sku'],
            'barcode' => ['nullable', 'string', 'max:64', 'unique:product_variants,barcode'],

            'variant_name' => ['required', 'string', 'max:180'],
            'flavor' => ['nullable', 'string', 'max:120'],
            'nicotine_strength' => ['nullable', 'string', 'max:40'],
            'resistance' => ['nullable', 'string', 'max:40'],
            'capacity' => ['nullable', 'string', 'max:40'],
            'color' => ['nullable', 'string', 'max:60'],

            'is_age_restricted' => ['boolean'],
            'contains_nicotine' => ['boolean'],
            'is_battery' => ['boolean'],
            'is_consumable' => ['boolean'],

            'default_cost' => ['numeric', 'min:0'],
            'default_price' => ['required', 'numeric', 'gt:0'],
            'is_active' => ['boolean'],
        ]);

        // defaults (if omitted)
        $data['is_age_restricted'] = $data['is_age_restricted'] ?? true;
        $data['contains_nicotine'] = $data['contains_nicotine'] ?? true;
        $data['is_battery'] = $data['is_battery'] ?? false;
        $data['is_consumable'] = $data['is_consumable'] ?? true;
        $data['default_cost'] = $data['default_cost'] ?? 0;
        $data['is_active'] = $data['is_active'] ?? true;

        $variant = ProductVariant::create($data);

        // Ensure inventory balances exist so the variant shows in /inventory (qty defaults to 0)
        $branchIds = Branch::query()->pluck('id');
        foreach ($branchIds as $branchId) {
            InventoryBalance::firstOrCreate(
                [
                    'branch_id' => $branchId,
                    'product_variant_id' => $variant->id,
                ],
                [
                    'qty_on_hand' => 0,
                ]
            );
        }

        return response()->json($variant->load(['product.brand', 'product.category']), 201);
    }

    public function show(ProductVariant $variant)
    {
        return $variant->load(['product.brand', 'product.category', 'priceHistories']);
    }

    public function update(Request $request, ProductVariant $variant)
    {
        $data = $request->validate([
            'sku' => ['sometimes', 'string', 'max:64', 'unique:product_variants,sku,' . $variant->id],
            'barcode' => ['sometimes', 'nullable', 'string', 'max:64', 'unique:product_variants,barcode,' . $variant->id],

            'variant_name' => ['sometimes', 'required', 'string', 'max:180'],
            'flavor' => ['nullable', 'string', 'max:120'],
            'nicotine_strength' => ['nullable', 'string', 'max:40'],
            'resistance' => ['nullable', 'string', 'max:40'],
            'capacity' => ['nullable', 'string', 'max:40'],
            'color' => ['nullable', 'string', 'max:60'],

            'is_age_restricted' => ['boolean'],
            'contains_nicotine' => ['boolean'],
            'is_battery' => ['boolean'],
            'is_consumable' => ['boolean'],

            'default_cost' => ['sometimes', 'numeric', 'min:0'],
            'default_price' => ['sometimes', 'required', 'numeric', 'gt:0'],
        ]);

        $variant->update($data);

        return $variant->load(['product.brand', 'product.category']);
    }

    public function destroy(ProductVariant $variant)
    {
        $variant->update(['is_active' => false]);
        return response()->json(['status' => 'ok']);
    }

    public function enable(ProductVariant $variant)
    {
        $variant->update(['is_active' => true]);
        return response()->json(['status' => 'ok']);
    }

    /**
     * Permanent delete (SAFE):
     * - must be disabled first
     * - must have zero on-hand everywhere
     * - must have no ledger/history/workflow references
     */
    public function purge(ProductVariant $variant)
    {
        if ($variant->is_active) {
            return response()->json([
                'message' => 'Disable the variant before deleting permanently.',
            ], 422);
        }

        $hasNonZero = InventoryBalance::query()
            ->where('product_variant_id', $variant->id)
            ->where('qty_on_hand', '!=', 0)
            ->exists();

        if ($hasNonZero) {
            return response()->json([
                'message' => 'Cannot delete: this variant still has stock on hand in one or more branches.',
            ], 422);
        }

        if (StockLedger::where('product_variant_id', $variant->id)->exists()) {
            return response()->json([
                'message' => 'Cannot delete: this variant has stock ledger history.',
            ], 422);
        }

        if (StockAdjustmentItem::where('product_variant_id', $variant->id)->exists()) {
            return response()->json([
                'message' => 'Cannot delete: referenced by stock adjustments.',
            ], 422);
        }

        if (TransferItem::where('product_variant_id', $variant->id)->exists()) {
            return response()->json([
                'message' => 'Cannot delete: referenced by transfers.',
            ], 422);
        }

        if (PurchaseOrderItem::where('product_variant_id', $variant->id)->exists()) {
            return response()->json([
                'message' => 'Cannot delete: referenced by purchase orders.',
            ], 422);
        }

        if (PriceHistory::where('product_variant_id', $variant->id)->exists()) {
            return response()->json([
                'message' => 'Cannot delete: this variant has price history.',
            ], 422);
        }

        $variant->delete();

        return response()->json(['status' => 'ok']);
    }
}
