<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class SalePayment extends Model
{
    protected $fillable = [
        'sale_id',
        'method',
        'amount',
        'paid_at',
        'reference_no',
        'client_txn_id',
        'received_by_user_id',
        'notes',
    ];

    protected $casts = [
        'amount' => 'float',
        'paid_at' => 'datetime',
    ];

    public function sale()
    {
        return $this->belongsTo(Sale::class);
    }

    public function receivedBy()
    {
        return $this->belongsTo(User::class, 'received_by_user_id');
    }
}
