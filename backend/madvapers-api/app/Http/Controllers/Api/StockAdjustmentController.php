<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Controllers\Api\Concerns\EnforcesBranchAccess;
use App\Models\StockAdjustment;
use App\Models\StockAdjustmentItem;
use App\Services\InventoryService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class StockAdjustmentController extends Controller
{
    use EnforcesBranchAccess;

    // GET /api/adjustments?branch_id=1&status=DRAFT
    public function index(Request $request)
    {
        $q = StockAdjustment::query()
            ->with(['branch', 'items.variant.product', 'createdBy', 'approvedBy', 'postedBy'])
            ->orderBy('id', 'desc');

        // Non-admin/owner users are always scoped to their assigned branch.
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

        return DB::transaction(function () use ($data, $userId) {
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

            foreach ($data['items'] as $it) {
                StockAdjustmentItem::create([
                    'stock_adjustment_id' => $adj->id,
                    'product_variant_id' => $it['product_variant_id'],
                    'qty_delta' => $it['qty_delta'],
                    'unit_cost' => $it['unit_cost'] ?? null,
                    'notes' => $it['notes'] ?? null,
                ]);
            }

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
        return DB::transaction(function () use ($request, $adjustment) {
            $locked = StockAdjustment::query()
                ->lockForUpdate()
                ->findOrFail($adjustment->id);

            $this->enforceBranchAccessOrFail($request, (int) $locked->branch_id);

            if ($locked->status !== 'DRAFT') {
                return response()->json(['message' => 'Only DRAFT can be submitted.'], 422);
            }

            $locked->update(['status' => 'SUBMITTED']);

            return response()->json(['status' => 'ok', 'adjustment' => $locked]);
        });
    }

    // POST /api/adjustments/{id}/approve
    public function approve(Request $request, StockAdjustment $adjustment)
    {
        return DB::transaction(function () use ($request, $adjustment) {
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

            return response()->json(['status' => 'ok', 'adjustment' => $locked]);
        });
    }

    // POST /api/adjustments/{id}/post  (writes to ledger + balances)
    public function post(Request $request, StockAdjustment $adjustment, InventoryService $inv)
    {
        return DB::transaction(function () use ($request, $adjustment, $inv) {
            $locked = StockAdjustment::query()
                ->lockForUpdate()
                ->findOrFail($adjustment->id);

            $this->enforceBranchAccessOrFail($request, (int) $locked->branch_id);

            if ($locked->status !== 'APPROVED') {
                return response()->json(['message' => 'Only APPROVED can be posted.'], 422);
            }

            $locked->load('items');

            foreach ($locked->items as $item) {
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

            return response()->json(['status' => 'ok', 'adjustment' => $locked]);
        });
    }
}
