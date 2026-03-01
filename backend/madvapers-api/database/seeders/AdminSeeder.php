<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use App\Models\User;
use App\Models\Role;
use App\Models\Branch;
use Illuminate\Support\Str;

class AdminSeeder extends Seeder
{
    private function seedPassword(): string
    {
        $fromEnv = trim((string) env('SEED_DEFAULT_PASSWORD', ''));
        if ($fromEnv !== '') {
            return $fromEnv;
        }

        if (app()->environment('testing')) {
            return 'password123';
        }

        return Str::random(32);
    }

    public function run(): void
    {
        $adminRole = Role::where('code', 'ADMIN')->first();
        $mainBranch = Branch::where('code', 'BAGACAY')->first();
        $password = $this->seedPassword();

        $admin = User::updateOrCreate(
            ['email' => 'admin@madvapers.local'],
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
