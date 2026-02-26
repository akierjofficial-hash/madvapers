<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use App\Models\User;
use App\Models\Role;
use App\Models\Branch;

class UserSeeder extends Seeder
{
    public function run(): void
    {
        $bagacay = Branch::where('code', 'BAGACAY')->first();
        $motong = Branch::where('code', 'MOTONG')->first();

        $roles = [
            'OWNER'   => Role::where('code', 'OWNER')->first(),
            'ADMIN'   => Role::where('code', 'ADMIN')->first(),
            'MANAGER' => Role::where('code', 'MANAGER')->first(),
            'CLERK'   => Role::where('code', 'CLERK')->first(),
            'CASHIER' => Role::where('code', 'CASHIER')->first(),
            'AUDITOR' => Role::where('code', 'AUDITOR')->first(),
        ];

        $make = function (string $email, string $name, ?Role $role, ?Branch $branch) {
            if (!$role || !$branch) return;

            $user = User::updateOrCreate(
                ['email' => $email],
                ['name' => $name, 'password' => bcrypt('password123')]
            );

            $user->role()->associate($role);
            $user->branch()->associate($branch);
            $user->save();
            $user->branches()->syncWithoutDetaching([$branch->id]);
        };

        // Keep admin (main branch)
        $make('admin@madvapers.local', 'Admin', $roles['ADMIN'], $bagacay);

        // Demo accounts
        $make('owner@madvapers.local',   'Owner',   $roles['OWNER'],   $bagacay);
        $make('manager@madvapers.local', 'Manager', $roles['MANAGER'], $bagacay);
        $make('clerk@madvapers.local',   'Clerk',   $roles['CLERK'],   $motong);
        $make('cashier@madvapers.local', 'Cashier', $roles['CASHIER'], $bagacay);
        $make('auditor@madvapers.local', 'Auditor', $roles['AUDITOR'], $bagacay);
    }
}
