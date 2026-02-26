<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Factories\HasFactory;

class Branch extends Model
{
    use HasFactory;

    protected $fillable = [
        'code',
        'name',
        'address',
        'locator',
        'cellphone_no',
        'is_active',
    ];

    public function users()
    {
        return $this->belongsToMany(User::class)
            ->withTimestamps();
    }
}
