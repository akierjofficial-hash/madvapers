<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Foundation\Auth\User as Authenticatable;
use Illuminate\Notifications\Notifiable;
use Laravel\Sanctum\HasApiTokens;

class User extends Authenticatable
{
    use HasApiTokens, HasFactory, Notifiable;

    protected $fillable = ['name', 'email', 'password', 'role_id', 'branch_id', 'is_active'];
    protected $hidden = ['password', 'remember_token'];
    private ?array $permissionCodeCache = null;

    protected function casts(): array
    {
        return [
            'email_verified_at' => 'datetime',
            'password' => 'hashed',
            'is_active' => 'boolean',
        ];
    }

    public function role()
    {
        return $this->belongsTo(Role::class);
    }

    public function branch()
    {
        return $this->belongsTo(Branch::class);
    }

    public function branches()
    {
        return $this->belongsToMany(Branch::class)
            ->withTimestamps();
    }

    public function pushSubscriptions()
    {
        return $this->hasMany(PushSubscription::class);
    }

    public function hasPermission(string $permissionCode): bool
    {
        $targetCode = strtoupper(trim($permissionCode));
        if ($targetCode === '') {
            return false;
        }

        if (!$this->role) {
            return false;
        }

        if ($this->permissionCodeCache === null) {
            $role = $this->role;
            if (!$role->relationLoaded('permissions')) {
                $role->load('permissions:id,code');
            }

            $this->permissionCodeCache = $role->permissions
                ->pluck('code')
                ->map(fn ($code) => strtoupper((string) $code))
                ->unique()
                ->values()
                ->all();
        }

        return in_array($targetCode, $this->permissionCodeCache, true);
    }
}
