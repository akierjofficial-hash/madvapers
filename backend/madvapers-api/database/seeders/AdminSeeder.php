<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use App\Models\User;
use App\Models\Role;
use App\Models\Branch;

class AdminSeeder extends Seeder
{
    public function run(): void
    {
        $adminRole = Role::where('code', 'ADMIN')->first();
        $mainBranch = Branch::where('code', 'BAGACAY')->first();

        $admin = User::updateOrCreate(
            ['email' => 'admin@madvapers.local'],
            ['name' => 'Admin', 'password' => bcrypt('password123')]
        );

        if ($adminRole) $admin->role()->associate($adminRole);
        if ($mainBranch) $admin->branch()->associate($mainBranch);

        $admin->save();

        if ($mainBranch) {
            $admin->branches()->syncWithoutDetaching([$mainBranch->id]);
        }
    }
}
