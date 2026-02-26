<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Factories\HasFactory;

class ProductVariant extends Model
{
    use HasFactory;

    protected $fillable = [
        'product_id',
        'sku',
        'barcode',
        'variant_name',
        'flavor',
        'nicotine_strength',
        'resistance',
        'capacity',
        'color',
        'is_age_restricted',
        'contains_nicotine',
        'is_battery',
        'is_consumable',
        'default_cost',
        'default_price',
        'is_active',
    ];

    public function product()
    {
        return $this->belongsTo(Product::class);
    }

    public function priceHistories()
    {
        return $this->hasMany(PriceHistory::class);
    }
}