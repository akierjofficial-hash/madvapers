<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Controllers\Api\Concerns\EnforcesBranchAccess;
use App\Models\Transfer;
use App\Models\TransferItem;
use App\Models\InventoryBalance;
use App\Services\InventoryService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

class TransferController extends Controller
{
    use EnforcesBranchAccess;

    public function index(Request $request)
    {
        $q = Transfer::query()->with(['items', 'fromBranch', 'toBranch']);

        // Non-admin/owner users can only see transfers touching their assigned branch.
        $this->scopeTransfersToAssignedBranch($request, $q);

        if ($request->filled('from_branch_id')) {
            $q->where('from_branch_id', (int)$request->from_branch_id);
        }
        if ($request->filled('to_branch_id')) {
            $q->where('to_branch_id', (int)$request->to_branch_id);
        }
        if ($request->filled('status')) {
            $q->where('status', strtoupper((string)$request->status));
        }

        return $q->orderByDesc('id')->paginate(50);
    }

    public function show(Request $request, Transfer $transfer)
    {
        $this->enforceTransferTouchAccessOrFail(
            $request,
            (int) $transfer->from_branch_id,
            (int) $transfer->to_branch_id
        );

        return $transfer->load(['items.variant', 'fromBranch', 'toBranch']);
    }

    public function store(Request $request)
    {
        $data = $request->validate([
            'from_branch_id' => ['required', 'integer', 'exists:branches,id'],
            'to_branch_id'   => ['required', 'integer', 'exists:branches,id', 'different:from_branch_id'],
            'notes'          => ['nullable', 'string'],
            'items'          => ['required', 'array', 'min:1'],
            'items.*.product_variant_id' => ['required', 'integer', 'exists:product_variants,id'],
            'items.*.qty'               => ['required', 'numeric', 'gt:0'],
            'items.*.unit_cost'         => ['nullable', 'numeric', 'gte:0'],
        ]);

        // Non-admin/owner users can only originate transfers from their own branch.
        $this->enforceTransferFromBranchAccessOrFail($request, (int) $data['from_branch_id']);

        return DB::transaction(function () use ($data, $request) {
            $transfer = Transfer::create([
                'from_branch_id' => $data['from_branch_id'],
                'to_branch_id'   => $data['to_branch_id'],
                'status'         => 'DRAFT',
                'notes'          => $data['notes'] ?? null,
                'created_by_user_id' => $request->user()?->id,
            ]);

            foreach ($data['items'] as $line) {
                TransferItem::create([
                    'transfer_id' => $transfer->id,
                    'product_variant_id' => $line['product_variant_id'],
                    'qty' => $line['qty'],
                    'unit_cost' => $line['unit_cost'] ?? null,
                ]);
            }

            return $transfer->load(['items.variant', 'fromBranch', 'toBranch']);
        });
    }

    public function update(Request $request, Transfer $transfer)
    {
        $data = $request->validate([
            'from_branch_id' => ['sometimes', 'integer', 'exists:branches,id'],
            'to_branch_id'   => ['sometimes', 'integer', 'exists:branches,id'],
            'notes'          => ['nullable', 'string'],
            'items'          => ['sometimes', 'array', 'min:1'],
            'items.*.product_variant_id' => ['required_with:items', 'integer', 'exists:product_variants,id'],
            'items.*.qty'               => ['required_with:items', 'numeric', 'gt:0'],
            'items.*.unit_cost'         => ['nullable', 'numeric', 'gte:0'],
        ]);

        return DB::transaction(function () use ($request, $data, $transfer) {
            $locked = $this->lockTransfer($transfer->id);

            $this->enforceTransferFromBranchAccessOrFail($request, (int) $locked->from_branch_id);

            if ($locked->status !== 'DRAFT') {
                throw ValidationException::withMessages([
                    'status' => ['Only DRAFT transfers can be edited.'],
                ]);
            }

            $from = $data['from_branch_id'] ?? $locked->from_branch_id;
            $to   = $data['to_branch_id'] ?? $locked->to_branch_id;
            if ($from === $to) {
                throw ValidationException::withMessages([
                    'to_branch_id' => ['Destination branch must be different from source branch.'],
                ]);
            }

            $this->enforceTransferFromBranchAccessOrFail($request, (int) $from);

            $locked->from_branch_id = $from;
            $locked->to_branch_id = $to;
            if (array_key_exists('notes', $data)) {
                $locked->notes = $data['notes'];
            }
            $locked->save();

            if (isset($data['items'])) {
                // replace items (simple + safe in draft)
                $locked->items()->delete();
                foreach ($data['items'] as $line) {
                    TransferItem::create([
                        'transfer_id' => $locked->id,
                        'product_variant_id' => $line['product_variant_id'],
                        'qty' => $line['qty'],
                        'unit_cost' => $line['unit_cost'] ?? null,
                    ]);
                }
            }

            return $locked->load(['items.variant', 'fromBranch', 'toBranch']);
        });
    }

    public function requestTransfer(Request $request, Transfer $transfer)
    {
        return DB::transaction(function () use ($request, $transfer) {
            $locked = $this->lockTransfer($transfer->id);

            $this->enforceTransferFromBranchAccessOrFail($request, (int) $locked->from_branch_id);

            if ($locked->status !== 'DRAFT') {
                throw ValidationException::withMessages([
                    'status' => ['Only DRAFT transfers can be requested.'],
                ]);
            }

            if ($locked->items()->count() < 1) {
                throw ValidationException::withMessages([
                    'items' => ['Transfer must have at least 1 item.'],
                ]);
            }

            $locked->status = 'REQUESTED';
            $locked->save();

            return response()->json([
                'status' => 'ok',
                'transfer' => $locked->fresh()->load(['items.variant','fromBranch','toBranch']),
            ]);
        });
    }

    public function approve(Request $request, Transfer $transfer)
    {
        return DB::transaction(function () use ($request, $transfer) {
            $locked = $this->lockTransfer($transfer->id);

            $this->enforceTransferTouchAccessOrFail(
                $request,
                (int) $locked->from_branch_id,
                (int) $locked->to_branch_id
            );

            if ($locked->status !== 'REQUESTED') {
                throw ValidationException::withMessages([
                    'status' => ['Only REQUESTED transfers can be approved.'],
                ]);
            }

            $locked->status = 'APPROVED';
            $locked->approved_by_user_id = $request->user()?->id;
            $locked->approved_at = now();
            $locked->save();

            return response()->json([
                'status' => 'ok',
                'transfer' => $locked->fresh()->load(['items.variant','fromBranch','toBranch']),
            ]);
        });
    }

    /**
     * DISPATCH: creates TRANSFER_OUT ledger entries from from_branch.
     * RULE: block if insufficient stock.
     */
    public function dispatch(Request $request, Transfer $transfer, InventoryService $inventoryService)
    {
        return DB::transaction(function () use ($request, $transfer, $inventoryService) {
            $locked = $this->lockTransfer($transfer->id);

            $this->enforceTransferFromBranchAccessOrFail($request, (int) $locked->from_branch_id);

            if ($locked->status !== 'APPROVED') {
                throw ValidationException::withMessages([
                    'status' => ['Only APPROVED transfers can be dispatched.'],
                ]);
            }

            $items = $locked->items()->get();

            // Lock inventory rows for source branch so check + post is race-safe
            $insufficient = [];

            foreach ($items as $it) {
                $bal = InventoryBalance::query()
                    ->where('branch_id', $locked->from_branch_id)
                    ->where('product_variant_id', $it->product_variant_id)
                    ->lockForUpdate()
                    ->first();

                $onHand = $bal?->qty_on_hand ?? 0;
                if ((float)$onHand < (float)$it->qty) {
                    $insufficient[] = [
                        'product_variant_id' => $it->product_variant_id,
                        'required' => (float)$it->qty,
                        'on_hand' => (float)$onHand,
                    ];
                }
            }

            if (!empty($insufficient)) {
                throw ValidationException::withMessages([
                    'stock' => ['Insufficient stock to dispatch.'],
                    'details' => $insufficient,
                ]);
            }

            // Post ledger OUT movements
            foreach ($items as $it) {
                $inventoryService->postMovement([
                    'branch_id' => $locked->from_branch_id,
                    'product_variant_id' => $it->product_variant_id,
                    'qty_delta' => -1 * (float)$it->qty,
                    'movement_type' => 'TRANSFER_OUT',
                    'reason_code' => 'TRANSFER_DISPATCH',
                    'ref_type' => 'transfers',
                    'ref_id' => $locked->id,
                    'performed_by_user_id' => $request->user()?->id,
                    'unit_cost' => $it->unit_cost,
                    'notes' => 'Transfer dispatch OUT',
                ]);
            }

            $locked->status = 'IN_TRANSIT';
            $locked->dispatched_by_user_id = $request->user()?->id;
            $locked->dispatched_at = now();
            $locked->save();

            return response()->json([
                'status' => 'ok',
                'transfer' => $locked->fresh()->load(['items.variant','fromBranch','toBranch']),
            ]);
        });
    }

    /**
     * RECEIVE: creates TRANSFER_IN ledger entries into to_branch.
     */
    public function receive(Request $request, Transfer $transfer, InventoryService $inventoryService)
    {
        return DB::transaction(function () use ($request, $transfer, $inventoryService) {
            $locked = $this->lockTransfer($transfer->id);

            $this->enforceTransferToBranchAccessOrFail($request, (int) $locked->to_branch_id);

            if ($locked->status !== 'IN_TRANSIT') {
                throw ValidationException::withMessages([
                    'status' => ['Only IN_TRANSIT transfers can be received.'],
                ]);
            }

            $items = $locked->items()->get();

            foreach ($items as $it) {
                $inventoryService->postMovement([
                    'branch_id' => $locked->to_branch_id,
                    'product_variant_id' => $it->product_variant_id,
                    'qty_delta' => (float)$it->qty,
                    'movement_type' => 'TRANSFER_IN',
                    'reason_code' => 'TRANSFER_RECEIVE',
                    'ref_type' => 'transfers',
                    'ref_id' => $locked->id,
                    'performed_by_user_id' => $request->user()?->id,
                    'unit_cost' => $it->unit_cost,
                    'notes' => 'Transfer receive IN',
                ]);
            }

            $locked->status = 'RECEIVED';
            $locked->received_by_user_id = $request->user()?->id;
            $locked->received_at = now();
            $locked->save();

            return response()->json([
                'status' => 'ok',
                'transfer' => $locked->fresh()->load(['items.variant','fromBranch','toBranch']),
            ]);
        });
    }

    public function cancel(Request $request, Transfer $transfer)
    {
        return DB::transaction(function () use ($request, $transfer) {
            $locked = $this->lockTransfer($transfer->id);

            $this->enforceTransferTouchAccessOrFail(
                $request,
                (int) $locked->from_branch_id,
                (int) $locked->to_branch_id
            );

            if (in_array($locked->status, ['RECEIVED', 'CANCELLED'], true)) {
                throw ValidationException::withMessages([
                    'status' => ['Cannot cancel a RECEIVED/CANCELLED transfer.'],
                ]);
            }

            // If already dispatched, cancellation becomes tricky (would require reversal movements).
            if ($locked->status === 'IN_TRANSIT') {
                throw ValidationException::withMessages([
                    'status' => ['Cannot cancel IN_TRANSIT transfer. Create a return transfer instead.'],
                ]);
            }

            $locked->status = 'CANCELLED';
            $locked->save();

            return response()->json([
                'status' => 'ok',
                'transfer' => $locked->fresh()->load(['items.variant','fromBranch','toBranch']),
            ]);
        });
    }

    private function lockTransfer(int $transferId): Transfer
    {
        return Transfer::query()
            ->lockForUpdate()
            ->findOrFail($transferId);
    }
}
