<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use App\Models\User;
use App\Models\Role;
use App\Models\Branch;

class AdminSeeder extends Seeder
{
    private function seedEmail(): string
    {
        $fromEnv = trim((string) env('SEED_ADMIN_EMAIL', ''));
        if ($fromEnv !== '') {
            return $fromEnv;
        }

        return 'admin@madvapers.com';
    }

    private function seedPassword(): string
    {
        $fromAdminEnv = trim((string) env('SEED_ADMIN_PASSWORD', ''));
        if ($fromAdminEnv !== '') {
            return $fromAdminEnv;
        }

        $fromEnv = trim((string) env('SEED_DEFAULT_PASSWORD', ''));
        if ($fromEnv !== '') {
            return $fromEnv;
        }

        return 'admin123';
    }

    public function run(): void
    {
        $adminRole = Role::where('code', 'ADMIN')->first();
        $mainBranch = Branch::query()
            ->where('is_active', true)
            ->orderBy('id')
            ->first();
        $password = $this->seedPassword();

        $admin = User::updateOrCreate(
            ['email' => $this->seedEmail()],
            ['name' => 'Admin', 'password' => bcrypt($password)]
        );

        if ($adminRole) $admin->role()->associate($adminRole);
        if ($mainBranch) $admin->branch()->associate($mainBranch);

        $admin->save();

        if ($mainBranch) {
            $admin->branches()->syncWithoutDetaching([$mainBranch->id]);
        }
    }
}
