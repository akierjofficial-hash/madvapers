<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (!Schema::hasTable('roles') || !Schema::hasTable('permissions') || !Schema::hasTable('role_permissions')) {
            return;
        }

        $clerkRoleId = DB::table('roles')->where('code', 'CLERK')->value('id');
        if (!$clerkRoleId) {
            return;
        }

        $requiredCodes = [
            'ADJUSTMENT_VIEW',
            'ADJUSTMENT_CREATE',
            'ADJUSTMENT_SUBMIT',
            'ADJUSTMENT_APPROVE',
            'ADJUSTMENT_POST',
        ];

        $permissionIds = DB::table('permissions')
            ->whereIn('code', $requiredCodes)
            ->pluck('id')
            ->map(fn ($id) => (int) $id)
            ->filter()
            ->values()
            ->all();

        if (empty($permissionIds)) {
            return;
        }

        $rows = array_map(
            fn (int $permissionId): array => [
                'role_id' => (int) $clerkRoleId,
                'permission_id' => $permissionId,
            ],
            $permissionIds
        );

        DB::table('role_permissions')->insertOrIgnore($rows);
    }

    public function down(): void
    {
        // Keep granted permissions; intentionally non-destructive.
    }
};

