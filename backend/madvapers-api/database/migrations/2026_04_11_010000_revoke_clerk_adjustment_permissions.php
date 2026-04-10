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

        $adjustmentPermissionIds = DB::table('permissions')
            ->whereIn('code', [
                'ADJUSTMENT_VIEW',
                'ADJUSTMENT_CREATE',
                'ADJUSTMENT_SUBMIT',
                'ADJUSTMENT_APPROVE',
                'ADJUSTMENT_POST',
            ])
            ->pluck('id')
            ->map(fn ($id) => (int) $id)
            ->filter()
            ->values()
            ->all();

        if (empty($adjustmentPermissionIds)) {
            return;
        }

        DB::table('role_permissions')
            ->where('role_id', (int) $clerkRoleId)
            ->whereIn('permission_id', $adjustmentPermissionIds)
            ->delete();
    }

    public function down(): void
    {
        if (!Schema::hasTable('roles') || !Schema::hasTable('permissions') || !Schema::hasTable('role_permissions')) {
            return;
        }

        $clerkRoleId = DB::table('roles')->where('code', 'CLERK')->value('id');
        if (!$clerkRoleId) {
            return;
        }

        $adjustmentPermissionIds = DB::table('permissions')
            ->whereIn('code', [
                'ADJUSTMENT_VIEW',
                'ADJUSTMENT_CREATE',
                'ADJUSTMENT_SUBMIT',
                'ADJUSTMENT_APPROVE',
                'ADJUSTMENT_POST',
            ])
            ->pluck('id')
            ->map(fn ($id) => (int) $id)
            ->filter()
            ->values()
            ->all();

        if (empty($adjustmentPermissionIds)) {
            return;
        }

        $rows = array_map(
            fn (int $permissionId): array => [
                'role_id' => (int) $clerkRoleId,
                'permission_id' => $permissionId,
            ],
            $adjustmentPermissionIds
        );

        DB::table('role_permissions')->insertOrIgnore($rows);
    }
};
