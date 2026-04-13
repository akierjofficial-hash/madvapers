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

        $permissionIds = DB::table('permissions')
            ->whereIn('code', [
                'TRANSFER_DISPATCH',
                'TRANSFER_RECEIVE',
            ])
            ->pluck('id')
            ->map(fn ($id) => (int) $id)
            ->filter()
            ->values()
            ->all();

        if (empty($permissionIds)) {
            return;
        }

        DB::table('role_permissions')
            ->whereIn('permission_id', $permissionIds)
            ->delete();
    }

    public function down(): void
    {
        if (!Schema::hasTable('roles') || !Schema::hasTable('permissions') || !Schema::hasTable('role_permissions')) {
            return;
        }

        $roleIds = DB::table('roles')
            ->whereIn('code', ['ADMIN', 'CLERK'])
            ->pluck('id')
            ->map(fn ($id) => (int) $id)
            ->filter()
            ->values()
            ->all();

        $permissionIds = DB::table('permissions')
            ->whereIn('code', [
                'TRANSFER_DISPATCH',
                'TRANSFER_RECEIVE',
            ])
            ->pluck('id')
            ->map(fn ($id) => (int) $id)
            ->filter()
            ->values()
            ->all();

        if (empty($roleIds) || empty($permissionIds)) {
            return;
        }

        $rows = [];
        foreach ($roleIds as $roleId) {
            foreach ($permissionIds as $permissionId) {
                $rows[] = [
                    'role_id' => $roleId,
                    'permission_id' => $permissionId,
                ];
            }
        }

        DB::table('role_permissions')->insertOrIgnore($rows);
    }
};
