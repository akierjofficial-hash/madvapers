<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Factories\HasFactory;

class StockLedger extends Model
{
    use HasFactory;

    protected $fillable = [
        'posted_at',
        'branch_id',
        'product_variant_id',
        'qty_delta',
        'movement_type',
        'reason_code',
        'ref_type',
        'ref_id',
        'performed_by_user_id',
        'unit_cost',
        'unit_price',
        'notes',
    ];

    protected $casts = [
        'posted_at' => 'datetime',
        'qty_delta' => 'decimal:3',
    ];

    public function branch()
    {
        return $this->belongsTo(Branch::class);
    }

    public function variant()
    {
        return $this->belongsTo(ProductVariant::class, 'product_variant_id');
    }

    public function performedBy()
    {
        return $this->belongsTo(User::class, 'performed_by_user_id');
    }
}