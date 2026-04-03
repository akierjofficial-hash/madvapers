<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use App\Models\User;
use App\Models\Role;
use App\Models\Branch;
use Illuminate\Support\Str;

class UserSeeder extends Seeder
{
    /**
     * Keep demo role accounts out of non-testing environments by default.
     */
    private function shouldSeedRoleUsers(): bool
    {
        if (app()->environment('testing')) {
            return true;
        }

        return filter_var((string) env('SEED_ROLE_USERS', 'false'), FILTER_VALIDATE_BOOLEAN);
    }

    /**
     * @return string[]
     */
    private function demoRoleEmails(): array
    {
        return [
            'owner@madvapers.local',
            'manager@madvapers.local',
            'clerk@madvapers.local',
            'cashier@madvapers.local',
            'auditor@madvapers.local',
        ];
    }

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
        if (!$this->shouldSeedRoleUsers()) {
            // Enforce "admin-only" default seeding posture.
            User::query()->whereIn('email', $this->demoRoleEmails())->delete();
            return;
        }

        $branches = Branch::query()
            ->where('is_active', true)
            ->orderBy('id')
            ->get();
        $primaryBranch = $branches->get(0);
        $secondaryBranch = $branches->get(1) ?? $primaryBranch;
        $password = $this->seedPassword();

        $roles = [
            'OWNER'   => Role::where('code', 'OWNER')->first(),
            'ADMIN'   => Role::where('code', 'ADMIN')->first(),
            'MANAGER' => Role::where('code', 'MANAGER')->first(),
            'CLERK'   => Role::where('code', 'CLERK')->first(),
            'CASHIER' => Role::where('code', 'CASHIER')->first(),
            'AUDITOR' => Role::where('code', 'AUDITOR')->first(),
        ];

        $make = function (string $email, string $name, ?Role $role, ?Branch $branch) use ($password) {
            if (!$role || !$branch) return;

            $user = User::updateOrCreate(
                ['email' => $email],
                ['name' => $name, 'password' => bcrypt($password)]
            );

            $user->role()->associate($role);
            $user->branch()->associate($branch);
            $user->save();
            $user->branches()->syncWithoutDetaching([$branch->id]);
        };

        // Optional demo role accounts (testing by default, opt-in elsewhere).
        $make('owner@madvapers.local', 'Owner', $roles['OWNER'], $primaryBranch);
        $make('manager@madvapers.local', 'Manager', $roles['MANAGER'], $primaryBranch);
        $make('clerk@madvapers.local', 'Clerk', $roles['CLERK'], $secondaryBranch);
        $make('cashier@madvapers.local', 'Cashier', $roles['CASHIER'], $primaryBranch);
        $make('auditor@madvapers.local', 'Auditor', $roles['AUDITOR'], $primaryBranch);
    }
}
