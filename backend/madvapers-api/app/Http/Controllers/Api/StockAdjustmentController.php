<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Controllers\Api\Concerns\EnforcesBranchAccess;
use App\Models\InventoryBalance;
use App\Models\StockAdjustment;
use App\Models\StockAdjustmentItem;
use App\Services\AdminPushNotificationService;
use App\Support\AuditTrail;
use App\Services\InventoryService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

class StockAdjustmentController extends Controller
{
    use EnforcesBranchAccess;

    public function __construct(
        private readonly AdminPushNotificationService $adminPushNotifications
    ) {
    }

    // GET /api/adjustments?branch_id=1&status=DRAFT
    public function index(Request $request)
    {
        $q = StockAdjustment::query()
            ->with(['branch', 'items.variant.product', 'createdBy', 'approvedBy', 'postedBy'])
            ->orderBy('id', 'desc');

        // Non-admin users are always scoped to their assigned branch.
        $this->scopeToAssignedBranch($request, $q);

        if ($request->filled('branch_id')) {
            $branchId = $request->integer('branch_id');
            $this->enforceBranchAccessOrFail($request, $branchId);
            $q->where('branch_id', $branchId);
        }
        if ($request->filled('status')) $q->where('status', $request->string('status'));

        return $q->paginate(30);
    }

    // POST /api/adjustments
    public function store(Request $request)
    {
        $data = $request->validate([
            'branch_id' => ['required', 'integer', 'exists:branches,id'],
            'reason_code' => ['required', 'string', 'max:40'],
            'reference_no' => ['nullable', 'string', 'max:50'],
            'notes' => ['nullable', 'string'],

            'items' => ['required', 'array', 'min:1'],
            'items.*.product_variant_id' => ['required', 'integer', 'exists:product_variants,id'],
            'items.*.qty_delta' => ['required', 'numeric'],
            'items.*.unit_cost' => ['nullable', 'numeric'],
            'items.*.notes' => ['nullable', 'string', 'max:255'],
        ]);

        $this->enforceBranchAccessOrFail($request, (int) $data['branch_id']);

        $userId = $request->user()->id;

        return $this->transactionWithRetry(function () use ($data, $userId) {
            $referenceNo = $data['reference_no'] ?? null;

            $adj = StockAdjustment::create([
                'branch_id' => $data['branch_id'],
                'status' => 'DRAFT',
                'reason_code' => $data['reason_code'],
                'reference_no' => $referenceNo,
                'notes' => $data['notes'] ?? null,
                'created_by_user_id' => $userId,
            ]);

            if (!$referenceNo) {
                $referenceNo = sprintf('ADJ-%s-%06d', now()->format('Ymd'), $adj->id);
                $adj->update(['reference_no' => $referenceNo]);
            }

            $itemCount = 0;
            $totalQtyDelta = 0.0;
            foreach ($data['items'] as $it) {
                StockAdjustmentItem::create([
                    'stock_adjustment_id' => $adj->id,
                    'product_variant_id' => $it['product_variant_id'],
                    'qty_delta' => $it['qty_delta'],
                    'unit_cost' => $it['unit_cost'] ?? null,
                    'notes' => $it['notes'] ?? null,
                ]);
                $itemCount++;
                $totalQtyDelta += (float) $it['qty_delta'];
            }

            AuditTrail::record([
                'event_type' => 'ADJUSTMENT_DRAFT_CREATED',
                'entity_type' => 'adjustment',
                'entity_id' => (int) $adj->id,
                'branch_id' => (int) $adj->branch_id,
                'user_id' => $userId,
                'summary' => 'Adjustment draft created',
                'meta' => [
                    'reference_no' => (string) ($adj->reference_no ?? ''),
                    'reason_code' => (string) ($adj->reason_code ?? ''),
                    'status' => (string) ($adj->status ?? ''),
                    'item_count' => $itemCount,
                    'total_qty_delta' => round($totalQtyDelta, 4),
                ],
            ]);

            return response()->json(
                $adj->load(['branch', 'items.variant.product', 'createdBy', 'approvedBy', 'postedBy']),
                201
            );
        });
    }

    // GET /api/adjustments/{id}
    public function show(Request $request, StockAdjustment $adjustment)
    {
        $this->enforceBranchAccessOrFail($request, (int) $adjustment->branch_id);
        return $adjustment->load(['branch', 'items.variant.product', 'createdBy', 'approvedBy', 'postedBy']);
    }

    // POST /api/adjustments/{id}/submit
    public function submit(Request $request, StockAdjustment $adjustment)
    {
        $notifyContext = [
            'adjustment_id' => 0,
            'branch_id' => null,
            'reference_no' => '',
        ];

        $response = $this->transactionWithRetry(function () use ($request, $adjustment, &$notifyContext) {
            $locked = StockAdjustment::query()
                ->lockForUpdate()
                ->findOrFail($adjustment->id);

            $this->enforceBranchAccessOrFail($request, (int) $locked->branch_id);

            if ($locked->status !== 'DRAFT') {
                return response()->json(['message' => 'Only DRAFT can be submitted.'], 422);
            }

            $items = $locked->items()
                ->orderBy('product_variant_id')
                ->orderBy('id')
                ->get();

            $this->ensureAdjustmentStockAvailability(
                (int) $locked->branch_id,
                $items,
                'submit'
            );

            $locked->update(['status' => 'SUBMITTED']);
            $notifyContext['adjustment_id'] = (int) $locked->id;
            $notifyContext['branch_id'] = (int) $locked->branch_id;
            $notifyContext['reference_no'] = (string) ($locked->reference_no ?? '');

            AuditTrail::record([
                'event_type' => 'ADJUSTMENT_SUBMITTED',
                'entity_type' => 'adjustment',
                'entity_id' => (int) $locked->id,
                'branch_id' => (int) $locked->branch_id,
                'user_id' => $request->user()?->id,
                'summary' => 'Adjustment submitted',
                'meta' => [
                    'reference_no' => (string) ($locked->reference_no ?? ''),
                    'reason_code' => (string) ($locked->reason_code ?? ''),
                    'status' => 'SUBMITTED',
                ],
            ]);

            return response()->json(['status' => 'ok', 'adjustment' => $locked]);
        });

        if ((int) ($notifyContext['adjustment_id'] ?? 0) > 0) {
            $reference = trim((string) ($notifyContext['reference_no'] ?? ''));
            $label = $reference !== '' ? $reference : ('ADJ #' . (int) $notifyContext['adjustment_id']);

            $this->adminPushNotifications->sendApprovalRequestNotification(
                sprintf('Adjustment %s was submitted for approval.', $label),
                [
                    'type' => 'adjustment_request',
                    'entity_type' => 'adjustment',
                    'entity_id' => (int) $notifyContext['adjustment_id'],
                    'branch_id' => (int) $notifyContext['branch_id'],
                    'path' => '/adjustments',
                ]
            );
        }

        return $response;
    }

    // POST /api/adjustments/{id}/approve
    public function approve(Request $request, StockAdjustment $adjustment)
    {
        return $this->transactionWithRetry(function () use ($request, $adjustment) {
            $locked = StockAdjustment::query()
                ->lockForUpdate()
                ->findOrFail($adjustment->id);

            $this->enforceBranchAccessOrFail($request, (int) $locked->branch_id);

            if ($locked->status !== 'SUBMITTED') {
                return response()->json(['message' => 'Only SUBMITTED can be approved.'], 422);
            }

            $locked->update([
                'status' => 'APPROVED',
                'approved_by_user_id' => $request->user()->id,
                'approved_at' => now(),
            ]);

            AuditTrail::record([
                'event_type' => 'ADJUSTMENT_APPROVED',
                'entity_type' => 'adjustment',
                'entity_id' => (int) $locked->id,
                'branch_id' => (int) $locked->branch_id,
                'user_id' => $request->user()?->id,
                'summary' => 'Adjustment approved',
                'meta' => [
                    'reference_no' => (string) ($locked->reference_no ?? ''),
                    'reason_code' => (string) ($locked->reason_code ?? ''),
                    'status' => 'APPROVED',
                ],
            ]);

            return response()->json(['status' => 'ok', 'adjustment' => $locked]);
        });
    }

    // POST /api/adjustments/{id}/post  (writes to ledger + balances)
    public function post(Request $request, StockAdjustment $adjustment, InventoryService $inv)
    {
        return $this->transactionWithRetry(function () use ($request, $adjustment, $inv) {
            $locked = StockAdjustment::query()
                ->lockForUpdate()
                ->findOrFail($adjustment->id);

            $this->enforceBranchAccessOrFail($request, (int) $locked->branch_id);

            if ($locked->status !== 'APPROVED') {
                return response()->json(['message' => 'Only APPROVED can be posted.'], 422);
            }

            $locked->load('items');
            $items = $locked->items
                ->sortBy(function ($item) {
                    return sprintf('%010d-%010d', (int) $item->product_variant_id, (int) $item->id);
                })
                ->values();

            $this->ensureAdjustmentStockAvailability(
                (int) $locked->branch_id,
                $items,
                'post'
            );

            $itemCount = $items->count();
            $totalQtyDelta = (float) $items->sum(function ($item) {
                return (float) ($item->qty_delta ?? 0);
            });

            foreach ($items as $item) {
                $qtyDelta = (float) $item->qty_delta;
                $unitCost = $item->unit_cost === null ? null : (float) $item->unit_cost;

                $inv->applyInboundWeightedCost(
                    (int) $item->product_variant_id,
                    $qtyDelta,
                    $unitCost
                );

                $inv->postMovement([
                    'branch_id' => $locked->branch_id,
                    'product_variant_id' => $item->product_variant_id,
                    'qty_delta' => $item->qty_delta,
                    'movement_type' => 'ADJUSTMENT',
                    'reason_code' => $locked->reason_code,
                    'ref_type' => 'stock_adjustments',
                    'ref_id' => $locked->id,
                    'performed_by_user_id' => $request->user()->id,
                    'unit_cost' => $item->unit_cost,
                    'notes' => $item->notes ?? $locked->notes,
                ]);
            }

            $locked->update([
                'status' => 'POSTED',
                'posted_by_user_id' => $request->user()->id,
                'posted_at' => now(),
            ]);

            AuditTrail::record([
                'event_type' => 'ADJUSTMENT_POSTED',
                'entity_type' => 'adjustment',
                'entity_id' => (int) $locked->id,
                'branch_id' => (int) $locked->branch_id,
                'user_id' => $request->user()?->id,
                'summary' => 'Adjustment posted',
                'meta' => [
                    'reference_no' => (string) ($locked->reference_no ?? ''),
                    'reason_code' => (string) ($locked->reason_code ?? ''),
                    'status' => 'POSTED',
                    'item_count' => $itemCount,
                    'total_qty_delta' => round($totalQtyDelta, 4),
                ],
            ]);

            return response()->json(['status' => 'ok', 'adjustment' => $locked]);
        });
    }

    private function ensureAdjustmentStockAvailability(
        int $branchId,
        \Illuminate\Support\Collection $items,
        string $phase
    ): void {
        $variantIds = $items
            ->pluck('product_variant_id')
            ->map(fn ($id) => (int) $id)
            ->filter(fn ($id) => $id > 0)
            ->unique()
            ->values();

        if ($variantIds->isEmpty()) {
            return;
        }

        $balances = InventoryBalance::query()
            ->where('branch_id', $branchId)
            ->whereIn('product_variant_id', $variantIds->all())
            ->lockForUpdate()
            ->get(['product_variant_id', 'qty_on_hand']);

        $onHandByVariant = [];
        foreach ($balances as $balance) {
            $onHandByVariant[(int) $balance->product_variant_id] = (float) ($balance->qty_on_hand ?? 0);
        }

        $insufficient = [];

        foreach ($items as $item) {
            $variantId = (int) ($item->product_variant_id ?? 0);
            $qtyDelta = (float) ($item->qty_delta ?? 0);
            $available = (float) ($onHandByVariant[$variantId] ?? 0.0);

            if ($qtyDelta < 0) {
                $required = abs($qtyDelta);
                if ($available < $required) {
                    $insufficient[] = [
                        'product_variant_id' => $variantId,
                        'required' => $required,
                        'on_hand' => $available,
                    ];
                    continue;
                }
            }

            $onHandByVariant[$variantId] = $available + $qtyDelta;
        }

        if (!empty($insufficient)) {
            $label = strtoupper(trim($phase)) === 'SUBMIT' ? 'submit' : 'post';
            throw ValidationException::withMessages([
                'stock' => [sprintf('Insufficient stock to %s adjustment.', $label)],
                'details' => $insufficient,
            ]);
        }
    }
}
