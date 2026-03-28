<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class Expense extends Model
{
    use HasFactory;

    protected $fillable = [
        'expense_number',
        'branch_id',
        'category',
        'amount',
        'paid_at',
        'status',
        'notes',
        'created_by_user_id',
        'voided_by_user_id',
        'voided_at',
    ];

    protected $casts = [
        'amount' => 'float',
        'paid_at' => 'datetime',
        'voided_at' => 'datetime',
    ];

    public function branch()
    {
        return $this->belongsTo(Branch::class);
    }

    public function createdBy()
    {
        return $this->belongsTo(User::class, 'created_by_user_id');
    }

    public function voidedBy()
    {
        return $this->belongsTo(User::class, 'voided_by_user_id');
    }
}

