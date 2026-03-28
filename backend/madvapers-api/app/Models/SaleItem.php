<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class SaleItem extends Model
{
    protected $fillable = [
        'sale_id',
        'product_variant_id',
        'qty',
        'unit_price',
        'line_discount',
        'line_tax',
        'line_total',
        'unit_cost_snapshot',
        'line_cogs',
        'notes',
    ];

    protected $casts = [
        'qty' => 'float',
        'unit_price' => 'float',
        'line_discount' => 'float',
        'line_tax' => 'float',
        'line_total' => 'float',
        'unit_cost_snapshot' => 'float',
        'line_cogs' => 'float',
    ];

    public function sale()
    {
        return $this->belongsTo(Sale::class);
    }

    public function variant()
    {
        return $this->belongsTo(ProductVariant::class, 'product_variant_id');
    }
}

