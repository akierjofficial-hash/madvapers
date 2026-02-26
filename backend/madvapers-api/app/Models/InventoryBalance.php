<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Factories\HasFactory;

class InventoryBalance extends Model
{
    use HasFactory;

    protected $fillable = [
        'branch_id',
        'product_variant_id',
        'qty_on_hand',
    ];

    public function branch()
    {
        return $this->belongsTo(Branch::class);
    }

    public function variant()
    {
        return $this->belongsTo(ProductVariant::class, 'product_variant_id');
    }
}