<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use App\Models\User;
use App\Models\Role;
use App\Models\Branch;
use Illuminate\Support\Str;
use RuntimeException;

class AdminSeeder extends Seeder
{
    /**
     * @return string[]
     */
    private function legacyDefaultAdminEmails(): array
    {
        return [
            'admin@madvapers.com',
            'admin@madvapers.local',
        ];
    }

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
        $seedEmail = $this->seedEmail();
        $password = $this->seedPassword();

        $admin = User::updateOrCreate(
            ['email' => $seedEmail],
            ['name' => 'Admin', 'password' => bcrypt($password)]
        );

        if ($adminRole) $admin->role()->associate($adminRole);
        if ($mainBranch) $admin->branch()->associate($mainBranch);

        $admin->save();

        if ($mainBranch) {
            $admin->branches()->syncWithoutDetaching([$mainBranch->id]);
        }

        // Prevent legacy seeded default admins from remaining active in non-test envs.
        if (!app()->environment('testing')) {
            $seedEmailNormalized = strtolower(trim($seedEmail));
            $legacyEmails = array_values(array_filter(
                $this->legacyDefaultAdminEmails(),
                static fn (string $email): bool => strtolower(trim($email)) !== $seedEmailNormalized
            ));

            if (!empty($legacyEmails)) {
                $legacyUsers = User::query()
                    ->whereIn('email', $legacyEmails)
                    ->where('id', '!=', $admin->id)
                    ->get();

                foreach ($legacyUsers as $legacyUser) {
                    $legacyUser->forceFill([
                        'name' => trim(($legacyUser->name ?: 'Admin') . ' (Legacy Disabled)'),
                        'email' => sprintf('disabled+legacy-admin-%d@invalid.local', (int) $legacyUser->id),
                        'password' => bcrypt(Str::random(64)),
                        'is_active' => false,
                    ]);
                    $legacyUser->save();
                    $legacyUser->tokens()->delete();
                }
            }
        }
    }
}
