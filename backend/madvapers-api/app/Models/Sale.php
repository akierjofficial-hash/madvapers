<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class Sale extends Model
{
    use HasFactory;

    protected $fillable = [
        'sale_number',
        'branch_id',
        'status',
        'payment_status',
        'void_request_status',
        'subtotal',
        'discount_total',
        'tax_total',
        'sf_charge',
        'grand_total',
        'paid_total',
        'change_given',
        'cashier_user_id',
        'posted_by_user_id',
        'voided_by_user_id',
        'void_requested_by_user_id',
        'void_rejected_by_user_id',
        'posted_at',
        'voided_at',
        'void_requested_at',
        'void_rejected_at',
        'void_request_notes',
        'void_rejection_notes',
        'notes',
    ];

    protected $casts = [
        'subtotal' => 'float',
        'discount_total' => 'float',
        'tax_total' => 'float',
        'sf_charge' => 'float',
        'grand_total' => 'float',
        'paid_total' => 'float',
        'change_given' => 'float',
        'posted_at' => 'datetime',
        'voided_at' => 'datetime',
        'void_requested_at' => 'datetime',
        'void_rejected_at' => 'datetime',
    ];

    public function branch()
    {
        return $this->belongsTo(Branch::class);
    }

    public function cashier()
    {
        return $this->belongsTo(User::class, 'cashier_user_id');
    }

    public function postedBy()
    {
        return $this->belongsTo(User::class, 'posted_by_user_id');
    }

    public function voidedBy()
    {
        return $this->belongsTo(User::class, 'voided_by_user_id');
    }

    public function voidRequestedBy()
    {
        return $this->belongsTo(User::class, 'void_requested_by_user_id');
    }

    public function voidRejectedBy()
    {
        return $this->belongsTo(User::class, 'void_rejected_by_user_id');
    }

    public function items()
    {
        return $this->hasMany(SaleItem::class);
    }

    public function payments()
    {
        return $this->hasMany(SalePayment::class);
    }
}
