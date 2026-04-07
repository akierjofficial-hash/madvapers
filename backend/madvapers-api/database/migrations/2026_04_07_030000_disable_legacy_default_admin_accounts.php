<?php

use App\Models\User;
use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Str;

return new class extends Migration
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

    public function up(): void
    {
        if (!Schema::hasTable('users') || !Schema::hasTable('roles')) {
            return;
        }

        $adminRoleId = DB::table('roles')
            ->whereRaw('UPPER(code) = ?', ['ADMIN'])
            ->value('id');

        if (!$adminRoleId) {
            return;
        }

        $legacyEmailLookup = collect($this->legacyDefaultAdminEmails())
            ->map(fn (string $email) => strtolower(trim($email)))
            ->filter()
            ->unique()
            ->values()
            ->all();

        if (empty($legacyEmailLookup)) {
            return;
        }

        $seedAdminEmail = strtolower(trim((string) env('SEED_ADMIN_EMAIL', '')));

        $candidateUsers = DB::table('users')
            ->select('id', 'name', 'email')
            ->where('role_id', $adminRoleId)
            ->get()
            ->filter(function ($user) use ($legacyEmailLookup) {
                $email = strtolower(trim((string) ($user->email ?? '')));
                return $email !== '' && in_array($email, $legacyEmailLookup, true);
            });

        foreach ($candidateUsers as $candidate) {
            $candidateEmail = strtolower(trim((string) ($candidate->email ?? '')));
            if ($seedAdminEmail !== '' && $candidateEmail === $seedAdminEmail) {
                continue;
            }

            // Never disable if this is the only active admin left.
            $hasOtherActiveAdmin = DB::table('users')
                ->where('role_id', $adminRoleId)
                ->where('is_active', true)
                ->where('id', '!=', $candidate->id)
                ->exists();

            if (!$hasOtherActiveAdmin) {
                continue;
            }

            DB::table('users')
                ->where('id', $candidate->id)
                ->update([
                    'name' => trim((string) ($candidate->name ?? 'Admin') . ' (Legacy Disabled)'),
                    'email' => sprintf('disabled+legacy-admin-%d@invalid.local', (int) $candidate->id),
                    'password' => Hash::make(Str::random(64)),
                    'remember_token' => null,
                    'is_active' => false,
                    'updated_at' => now(),
                ]);

            if (Schema::hasTable('personal_access_tokens')) {
                DB::table('personal_access_tokens')
                    ->where('tokenable_type', User::class)
                    ->where('tokenable_id', (int) $candidate->id)
                    ->delete();
            }
        }
    }

    public function down(): void
    {
        // Irreversible on purpose (credentials were rotated and disabled).
    }
};
