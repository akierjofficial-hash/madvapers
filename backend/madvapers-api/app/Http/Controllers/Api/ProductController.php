<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\InventoryBalance;
use App\Models\PriceHistory;
use App\Models\Product;
use App\Models\PurchaseOrderItem;
use App\Models\StockAdjustmentItem;
use App\Models\StockLedger;
use App\Models\TransferItem;
use Illuminate\Database\QueryException;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class ProductController extends Controller
{
    private function normalizeProductType(string $value): string
    {
        $normalized = strtoupper(trim($value));
        $normalized = preg_replace('/[^A-Z0-9]+/', '_', $normalized) ?? '';
        $normalized = preg_replace('/_+/', '_', $normalized) ?? '';
        $normalized = trim($normalized, '_');

        return $normalized !== '' ? $normalized : 'DEVICE';
    }

    private function normalizeProductName(string $value): string
    {
        $normalized = trim($value);
        $normalized = preg_replace('/\s+/', ' ', $normalized) ?? '';

        return $normalized;
    }

    private function duplicateProductExists(int $brandId, string $name, ?int $ignoreId = null): bool
    {
        $q = Product::query()
            ->where('brand_id', $brandId)
            ->where('name', $name);

        if ($ignoreId !== null) {
            $q->where('id', '!=', $ignoreId);
        }

        return $q->exists();
    }

    private function duplicateProductResponse(string $name)
    {
        return response()->json([
            'message' => sprintf('Product "%s" already exists for this brand.', $name),
            'errors' => [
                'name' => ['Product name must be unique per brand.'],
            ],
        ], 422);
    }

    private function isDuplicateBrandNameConstraint(QueryException $exception): bool
    {
        $sqlState = (string) ($exception->errorInfo[0] ?? $exception->getCode() ?? '');
        if ($sqlState !== '23505') {
            return false;
        }

        $details = strtolower((string) ($exception->errorInfo[2] ?? $exception->getMessage()));

        return str_contains($details, 'products_brand_id_name_unique');
    }

    public function index(Request $request)
    {
        $q = Product::query()
            ->with(['brand', 'category'])
            ->withCount('variants')
            ->orderBy('id', 'desc');

        if (!$request->boolean('include_inactive', false)) {
            $q->where('is_active', true);
        }

        if ($request->filled('search')) {
            $like = DB::getDriverName() === 'pgsql' ? 'ilike' : 'like';
            $term = '%' . trim((string) $request->input('search')) . '%';
            $q->where(function ($w) use ($like, $term) {
                $w->where('name', $like, $term)
                    ->orWhere('product_type', $like, $term)
                    ->orWhereHas('brand', fn ($b) => $b->where('name', $like, $term))
                    ->orWhereHas('category', fn ($c) => $c->where('name', $like, $term));
            });
        }

        if ($request->filled('brand_id')) {
            $q->where('brand_id', $request->integer('brand_id'));
        }

        if ($request->filled('category_id')) {
            $q->where('category_id', $request->integer('category_id'));
        }

        if ($request->filled('product_type')) {
            $q->where('product_type', $this->normalizeProductType((string) $request->input('product_type')));
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
            'brand_id' => ['required', 'exists:brands,id'],
            'category_id' => ['nullable', 'exists:categories,id'],
            'name' => ['required', 'string', 'max:180'],
            'product_type' => ['required', 'string', 'max:40', 'regex:/^[A-Za-z][A-Za-z0-9 _-]*$/'],
            'description' => ['nullable', 'string'],
            'base_price' => ['nullable', 'numeric', 'min:0'],
            'is_active' => ['boolean'],
        ]);

        $data['name'] = $this->normalizeProductName((string) $data['name']);
        $data['product_type'] = $this->normalizeProductType((string) $data['product_type']);

        if ($this->duplicateProductExists((int) $data['brand_id'], (string) $data['name'])) {
            return $this->duplicateProductResponse((string) $data['name']);
        }

        try {
            $product = Product::create($data);
        } catch (QueryException $exception) {
            if ($this->isDuplicateBrandNameConstraint($exception)) {
                return $this->duplicateProductResponse((string) $data['name']);
            }

            throw $exception;
        }

        return response()->json($product->load(['brand', 'category']), 201);
    }

    public function show(Product $product)
    {
        return $product->load(['brand', 'category', 'variants']);
    }

    public function update(Request $request, Product $product)
    {
        $data = $request->validate([
            'brand_id' => ['sometimes', 'required', 'exists:brands,id'],
            'category_id' => ['sometimes', 'nullable', 'exists:categories,id'],
            'name' => ['sometimes', 'string', 'max:180'],
            'product_type' => ['sometimes', 'string', 'max:40', 'regex:/^[A-Za-z][A-Za-z0-9 _-]*$/'],
            'description' => ['nullable', 'string'],
            'base_price' => ['sometimes', 'nullable', 'numeric', 'min:0'],
        ]);

        if (array_key_exists('name', $data)) {
            $data['name'] = $this->normalizeProductName((string) $data['name']);
        }

        if (array_key_exists('product_type', $data)) {
            $data['product_type'] = $this->normalizeProductType((string) $data['product_type']);
        }

        $targetBrandId = (int) ($data['brand_id'] ?? $product->brand_id);
        $targetName = (string) ($data['name'] ?? $product->name);

        if ($targetBrandId > 0 && $targetName !== '' && $this->duplicateProductExists($targetBrandId, $targetName, (int) $product->id)) {
            return $this->duplicateProductResponse($targetName);
        }

        try {
            $product->update($data);
        } catch (QueryException $exception) {
            if ($this->isDuplicateBrandNameConstraint($exception)) {
                return $this->duplicateProductResponse($targetName);
            }

            throw $exception;
        }

        return $product->load(['brand', 'category']);
    }

    public function destroy(Product $product)
    {
        // safer: deactivate rather than delete
        $product->update(['is_active' => false]);
        return response()->json(['status' => 'ok']);
    }

    public function enable(Product $product)
    {
        $product->update(['is_active' => true]);
        return response()->json(['status' => 'ok']);
    }

    /**
     * Permanent delete (safe purge):
     * - product must be disabled first
     * - product must have no variants
     */
    public function purge(Product $product)
    {
        if ($product->is_active) {
            return response()->json([
                'message' => 'Disable the product before deleting permanently.',
            ], 422);
        }

        $variants = $product->variants()
            ->orderBy('id')
            ->get(['id', 'sku', 'is_active']);

        if ($variants->isEmpty()) {
            $product->delete();

            return response()->json(['status' => 'ok']);
        }

        $activeVariantIds = $variants
            ->filter(fn ($variant) => (bool) ($variant->is_active ?? true))
            ->pluck('id')
            ->map(fn ($id) => (int) $id)
            ->values()
            ->all();

        if (!empty($activeVariantIds)) {
            return response()->json([
                'message' => 'Cannot delete product while it has active variants. Disable variants first.',
                'active_variant_ids' => $activeVariantIds,
            ], 422);
        }

        $blocked = [];
        $purgeableVariantIds = [];

        foreach ($variants as $variant) {
            $variantId = (int) $variant->id;

            $reasons = [];

            $hasNonZero = InventoryBalance::query()
                ->where('product_variant_id', $variantId)
                ->where('qty_on_hand', '!=', 0)
                ->exists();
            if ($hasNonZero) {
                $reasons[] = 'Variant still has stock on hand.';
            }

            if (StockLedger::query()->where('product_variant_id', $variantId)->exists()) {
                $reasons[] = 'Variant has stock ledger history.';
            }
            if (StockAdjustmentItem::query()->where('product_variant_id', $variantId)->exists()) {
                $reasons[] = 'Variant is referenced by stock adjustments.';
            }
            if (TransferItem::query()->where('product_variant_id', $variantId)->exists()) {
                $reasons[] = 'Variant is referenced by transfers.';
            }
            if (PurchaseOrderItem::query()->where('product_variant_id', $variantId)->exists()) {
                $reasons[] = 'Variant is referenced by purchase orders.';
            }
            if (PriceHistory::query()->where('product_variant_id', $variantId)->exists()) {
                $reasons[] = 'Variant has price history.';
            }

            if (!empty($reasons)) {
                $blocked[] = [
                    'variant_id' => $variantId,
                    'sku' => (string) ($variant->sku ?? ''),
                    'reasons' => $reasons,
                ];
                continue;
            }

            $purgeableVariantIds[] = $variantId;
        }

        if (!empty($blocked)) {
            return response()->json([
                'message' => 'Cannot delete product. One or more variants are not purgeable.',
                'blocked_variants' => $blocked,
            ], 422);
        }

        if (!empty($purgeableVariantIds)) {
            $product->variants()->whereIn('id', $purgeableVariantIds)->delete();
        }

        $product->delete();

        return response()->json(['status' => 'ok']);
    }
}
