<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Controllers\Api\Concerns\EnforcesBranchAccess;
use App\Models\PurchaseOrder;
use App\Models\PurchaseOrderItem;
use App\Services\InventoryService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Illuminate\Validation\ValidationException;

class PurchaseOrderController extends Controller
{
    use EnforcesBranchAccess;

    public function index(Request $request)
{
    $q = PurchaseOrder::query()
        ->with(['supplier', 'branch'])
        ->withCount('items')
        ->withSum('items as total_qty_ordered', 'qty_ordered')
        ->orderByDesc('id');

    // Non-admin/owner users are always scoped to their assigned branch.
    $this->scopeToAssignedBranch($request, $q);

    if ($request->filled('branch_id')) {
        $branchId = $request->integer('branch_id');
        $this->enforceBranchAccessOrFail($request, $branchId);
        $q->where('branch_id', $branchId);
    }
    if ($request->filled('status')) $q->where('status', $request->string('status'));

    return $q->paginate(20);
}

    public function show(Request $request, PurchaseOrder $po)
    {
        $this->enforceBranchAccessOrFail($request, (int) $po->branch_id);
        return $po->load(['supplier', 'branch', 'items.variant.product']);
    }

    public function store(Request $request)
    {
        $data = $request->validate([
            'supplier_id' => ['required', 'exists:suppliers,id'],
            'branch_id' => ['required', 'exists:branches,id'],
            'reference_no' => ['nullable', 'string', 'max:50'],
            'notes' => ['nullable', 'string'],
            'items' => ['required', 'array', 'min:1'],
            'items.*.product_variant_id' => ['required', 'exists:product_variants,id'],
            'items.*.qty_ordered' => ['required', 'numeric', 'gt:0'],
            'items.*.unit_cost' => ['required', 'numeric', 'gte:0'],
            'items.*.notes' => ['nullable', 'string', 'max:255'],
        ]);

        $this->enforceBranchAccessOrFail($request, (int) $data['branch_id']);

        return DB::transaction(function () use ($data, $request) {
            $poAttrs = [
                'supplier_id' => $data['supplier_id'],
                'branch_id' => $data['branch_id'],
                'status' => 'DRAFT',
            ];

            // Guard optional columns (prevents crashes if migration missing)
            if (Schema::hasColumn('purchase_orders', 'reference_no')) {
                $poAttrs['reference_no'] = $data['reference_no'] ?? null;
            }
            if (Schema::hasColumn('purchase_orders', 'notes')) {
                $poAttrs['notes'] = $data['notes'] ?? null;
            }
            if (Schema::hasColumn('purchase_orders', 'created_by_user_id')) {
                $poAttrs['created_by_user_id'] = $request->user()?->id;
            }

            $po = PurchaseOrder::create($poAttrs);

            foreach ($data['items'] as $it) {
                $qtyOrdered = (float) $it['qty_ordered'];
                $unitCost   = (float) $it['unit_cost'];

                $itemAttrs = [
                    'purchase_order_id' => $po->id,
                    'product_variant_id' => (int) $it['product_variant_id'],

                    // legacy column qty (NOT NULL in many schemas)
                    'qty' => $qtyOrdered,

                    'qty_ordered' => $qtyOrdered,
                    'qty_received' => 0,
                    'unit_cost' => $unitCost,
                    'line_total' => $qtyOrdered * $unitCost,
                    'notes' => $it['notes'] ?? null,
                ];

                PurchaseOrderItem::create($itemAttrs);
            }

            return $po->load(['items.variant.product', 'supplier', 'branch']);
        });
    }

    public function submit(Request $request, PurchaseOrder $po)
    {
        return DB::transaction(function () use ($request, $po) {
            $locked = $this->lockPurchaseOrder($po->id);
            $this->enforceBranchAccessOrFail($request, (int) $locked->branch_id);
            if ($locked->status !== 'DRAFT') {
                throw ValidationException::withMessages(['status' => ['Only DRAFT can be submitted.']]);
            }

            $update = ['status' => 'SUBMITTED'];
            if (Schema::hasColumn('purchase_orders', 'submitted_at')) {
                $update['submitted_at'] = now();
            }

            $locked->update($update);

            return response()->json([
                'status' => 'ok',
                'purchase_order' => $locked->fresh()->load(['supplier', 'branch', 'items.variant.product']),
            ]);
        });
    }

    public function approve(Request $request, PurchaseOrder $po)
    {
        return DB::transaction(function () use ($request, $po) {
            $locked = $this->lockPurchaseOrder($po->id);
            $this->enforceBranchAccessOrFail($request, (int) $locked->branch_id);
            if ($locked->status !== 'SUBMITTED') {
                throw ValidationException::withMessages(['status' => ['Only SUBMITTED can be approved.']]);
            }

            $update = ['status' => 'APPROVED'];
            if (Schema::hasColumn('purchase_orders', 'approved_at')) {
                $update['approved_at'] = now();
            }
            if (Schema::hasColumn('purchase_orders', 'approved_by_user_id')) {
                $update['approved_by_user_id'] = $request->user()?->id;
            }

            $locked->update($update);

            return response()->json([
                'status' => 'ok',
                'purchase_order' => $locked->fresh()->load(['supplier', 'branch', 'items.variant.product']),
            ]);
        });
    }

    public function cancel(Request $request, PurchaseOrder $po)
    {
        return DB::transaction(function () use ($request, $po) {
            $locked = $this->lockPurchaseOrder($po->id);
            $this->enforceBranchAccessOrFail($request, (int) $locked->branch_id);
            if (in_array($locked->status, ['RECEIVED', 'CANCELLED'], true)) {
                return response()->json(['message' => 'Purchase order can no longer be cancelled.'], 422);
            }

            $locked->status = 'CANCELLED';
            $locked->save();

            return $locked->fresh()->load(['items.variant.product', 'branch', 'supplier']);
        });
    }

    /**
     * Receive (supports two modes):
     * 1) No body sent -> auto receive ALL remaining qty.
     * 2) Partial receive -> body:
     *    { "lines": [ {"product_variant_id":1,"qty_received":3}, ... ], "notes": "DR #123" }
     */
    public function receive(Request $request, PurchaseOrder $po, InventoryService $svc)
    {
        $data = $request->validate([
            'notes' => ['nullable', 'string'],
            'lines' => ['sometimes', 'array', 'min:1'],
            'lines.*.product_variant_id' => ['required_with:lines', 'integer', 'exists:product_variants,id'],
            'lines.*.qty_received' => ['required_with:lines', 'numeric', 'gt:0'],
        ]);

        return DB::transaction(function () use ($po, $data, $request, $svc) {
            $locked = $this->lockPurchaseOrder($po->id);
            $this->enforceBranchAccessOrFail($request, (int) $locked->branch_id);

            if (method_exists($locked, 'isReceivable')) {
                if (!$locked->isReceivable()) {
                    throw ValidationException::withMessages(['status' => ['PO is not receivable. Must be APPROVED or PARTIALLY_RECEIVED.']]);
                }
            } elseif (!in_array($locked->status, ['APPROVED', 'PARTIALLY_RECEIVED'], true)) {
                throw ValidationException::withMessages(['status' => ['PO is not receivable. Must be APPROVED or PARTIALLY_RECEIVED.']]);
            }

            $locked->load('items');
            $itemsByVariant = $locked->items->keyBy('product_variant_id');
            $lines = $data['lines'] ?? [];

            // If caller does not provide lines, receive all remaining quantities.
            if (empty($lines)) {
                $lines = $locked->items
                    ->map(function ($item) {
                        $ordered = (float) ($item->qty_ordered ?? 0);
                        $received = (float) ($item->qty_received ?? 0);
                        $remaining = $ordered - $received;

                        return [
                            'product_variant_id' => (int) $item->product_variant_id,
                            'qty_received' => $remaining > 0 ? $remaining : 0,
                        ];
                    })
                    ->filter(fn ($line) => $line['qty_received'] > 0)
                    ->values()
                    ->all();
            }

            if (empty($lines)) {
                return response()->json(['message' => 'Nothing to receive.'], 422);
            }

            foreach ($lines as $line) {
                $variantId = (int) $line['product_variant_id'];
                $receiveQty = (float) $line['qty_received'];

                /** @var PurchaseOrderItem|null $item */
                $item = $itemsByVariant->get($variantId);
                if (!$item) {
                    throw ValidationException::withMessages([
                        'lines' => ["Variant {$variantId} is not part of this PO."],
                    ]);
                }

                $remaining = method_exists($item, 'remainingQty')
                    ? (float) $item->remainingQty()
                    : ((float) ($item->qty_ordered ?? 0) - (float) ($item->qty_received ?? 0));

                if ($receiveQty > $remaining + 1e-9) {
                    throw ValidationException::withMessages([
                        'lines' => ["Receiving qty {$receiveQty} exceeds remaining {$remaining} for variant {$variantId}."],
                    ]);
                }

                $item->qty_received = (float) ($item->qty_received ?? 0) + $receiveQty;
                $item->save();

                $svc->postMovement([
                    'branch_id' => $locked->branch_id,
                    'product_variant_id' => $variantId,
                    'qty_delta' => $receiveQty,
                    'movement_type' => 'PO_RECEIVE',
                    'reason_code' => 'PO_RECEIVE',
                    'performed_by_user_id' => $request->user()?->id,
                    'unit_cost' => $item->unit_cost,
                    'notes' => $data['notes'] ?? 'PO receive',
                    'ref_type' => 'purchase_orders',
                    'ref_id' => $locked->id,
                ]);
            }

            $locked->refresh()->load('items');
            $allReceived = $locked->items->every(function ($it) {
                $ordered = (float) ($it->qty_ordered ?? 0);
                $received = (float) ($it->qty_received ?? 0);
                return $received >= $ordered - 1e-9;
            });

            $locked->status = $allReceived ? 'RECEIVED' : 'PARTIALLY_RECEIVED';
            if ($allReceived && Schema::hasColumn('purchase_orders', 'received_at')) {
                $locked->received_at = now();
            }
            $locked->save();

            return response()->json([
                'status' => 'ok',
                'purchase_order' => $locked->fresh()->load(['items.variant.product', 'supplier', 'branch']),
            ]);
        });
    }

    private function lockPurchaseOrder(int $poId): PurchaseOrder
    {
        return PurchaseOrder::query()
            ->lockForUpdate()
            ->findOrFail($poId);
    }
}

