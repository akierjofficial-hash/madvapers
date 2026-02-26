<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class PurchaseOrderItem extends Model
{
    protected $fillable = [
        'purchase_order_id',
        'product_variant_id',
        'qty',          // ✅ must be fillable
        'qty_ordered',
        'qty_received',
        'unit_cost',
        'line_total',
        'notes',
    ];

    protected $casts = [
        'qty' => 'float',
        'qty_ordered' => 'float',
        'qty_received' => 'float',
        'unit_cost' => 'float',
        'line_total' => 'float',
    ];

    public function variant()
    {
        return $this->belongsTo(ProductVariant::class, 'product_variant_id');
    }

    public function remainingQty(): float
    {
        $ordered = $this->qty_ordered ?? $this->qty ?? 0;
        return max(0, (float)$ordered - (float)$this->qty_received);
    }
}