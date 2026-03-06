<?php

namespace App\Services;

use App\Models\InventoryBalance;
use App\Models\ProductVariant;
use App\Models\StockLedger;
use Illuminate\Database\QueryException;
use Illuminate\Support\Facades\DB;

class InventoryService
{
    public function applyInboundWeightedCost(int $productVariantId, float $inboundQty, ?float $unitCost): ?float
    {
        $qty = (float) $inboundQty;
        $cost = $unitCost === null ? null : (float) $unitCost;

        if (!is_finite($qty) || $qty <= 0 || $cost === null || !is_finite($cost) || $cost <= 0) {
            return null;
        }

        $variant = ProductVariant::query()
            ->whereKey($productVariantId)
            ->lockForUpdate()
            ->first();

        if (!$variant) {
            return null;
        }

        $currentQty = (float) InventoryBalance::query()
            ->where('product_variant_id', $productVariantId)
            ->lockForUpdate()
            ->get(['qty_on_hand'])
            ->sum(fn ($row) => (float) $row->qty_on_hand);

        $currentQty = max(0.0, $currentQty);
        $currentCost = max(0.0, (float) ($variant->default_cost ?? 0));
        $nextQty = $currentQty + $qty;
        if ($nextQty <= 0) {
            return null;
        }

        $nextCost = (($currentQty * $currentCost) + ($qty * $cost)) / $nextQty;
        $variant->default_cost = round($nextCost, 2);
        $variant->save();

        return (float) $variant->default_cost;
    }

    public function postMovement(array $data): StockLedger
    {
        // Required keys:
        // branch_id, product_variant_id, qty_delta, movement_type
        return DB::transaction(function () use ($data) {

            $ledger = StockLedger::create([
                'posted_at' => $data['posted_at'] ?? now(),
                'branch_id' => $data['branch_id'],
                'product_variant_id' => $data['product_variant_id'],
                'qty_delta' => $data['qty_delta'],
                'movement_type' => $data['movement_type'],
                'reason_code' => $data['reason_code'] ?? null,
                'ref_type' => $data['ref_type'] ?? null,
                'ref_id' => $data['ref_id'] ?? null,
                'performed_by_user_id' => $data['performed_by_user_id'] ?? null,
                'unit_cost' => $data['unit_cost'] ?? null,
                'unit_price' => $data['unit_price'] ?? null,
                'notes' => $data['notes'] ?? null,
            ]);

            $key = [
                'branch_id' => $data['branch_id'],
                'product_variant_id' => $data['product_variant_id'],
            ];

            $balance = InventoryBalance::query()
                ->where($key)
                ->lockForUpdate()
                ->first();

            if (!$balance) {
                try {
                    InventoryBalance::create($key + ['qty_on_hand' => 0]);
                } catch (QueryException $e) {
                    // Another transaction may have inserted the row first.
                }

                $balance = InventoryBalance::query()
                    ->where($key)
                    ->lockForUpdate()
                    ->firstOrFail();
            }

            $balance->increment('qty_on_hand', (float) $data['qty_delta']);

            return $ledger;
        });
    }
}
