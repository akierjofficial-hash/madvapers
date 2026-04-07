<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use App\Models\User;
use App\Models\Role;
use App\Models\Branch;
use RuntimeException;

class AdminSeeder extends Seeder
{
    private function seedEmail(): string
    {
        $fromEnv = trim((string) env('SEED_ADMIN_EMAIL', ''));
        if ($fromEnv !== '') {
            return $fromEnv;
        }

        if (app()->environment('testing')) {
            return 'admin@madvapers.local';
        }

        throw new RuntimeException('SEED_ADMIN_EMAIL is required. Refusing to seed default admin credentials.');
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

        if (app()->environment('testing')) {
            return 'password123';
        }

        throw new RuntimeException('SEED_ADMIN_PASSWORD or SEED_DEFAULT_PASSWORD is required for admin seeding.');
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
