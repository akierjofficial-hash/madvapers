<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Factories\HasFactory;

class TransferItem extends Model
{
    use HasFactory;

    protected $fillable = [
        'transfer_id','product_variant_id','qty','unit_cost'
    ];

    protected $casts = [
        'qty' => 'decimal:3',
    ];

    public function transfer()
    {
        return $this->belongsTo(Transfer::class);
    }

    public function variant()
    {
        return $this->belongsTo(ProductVariant::class, 'product_variant_id');
    }
}