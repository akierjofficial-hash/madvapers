<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use App\Models\Role;
use App\Models\Permission;

class RolePermissionSeeder extends Seeder
{
    public function run(): void
    {
        $permissions = [
            // System / Security
            ['code' => 'AUDIT_VIEW', 'name' => 'View audit logs'],
            ['code' => 'USER_VIEW', 'name' => 'View users'],
            ['code' => 'USER_CREATE', 'name' => 'Create users'],
            ['code' => 'USER_UPDATE', 'name' => 'Update users'],
            ['code' => 'USER_DISABLE', 'name' => 'Disable users'],
            ['code' => 'ROLE_VIEW', 'name' => 'View roles & permissions'],
            ['code' => 'ROLE_MANAGE', 'name' => 'Manage roles & permissions'],
            ['code' => 'STAFF_ATTENDANCE_VIEW', 'name' => 'View staff attendance'],
            ['code' => 'STAFF_ATTENDANCE_CLOCK', 'name' => 'Request own staff time in/out'],
            ['code' => 'STAFF_ATTENDANCE_APPROVE', 'name' => 'Approve or reject staff time in'],

            // Branches
            ['code' => 'BRANCH_VIEW', 'name' => 'View branches'],
            ['code' => 'BRANCH_MANAGE', 'name' => 'Manage branches'],

            // Products & Pricing
            ['code' => 'PRODUCT_VIEW', 'name' => 'View products'],
            ['code' => 'PRODUCT_CREATE', 'name' => 'Create products'],
            ['code' => 'PRODUCT_UPDATE', 'name' => 'Update products'],
            ['code' => 'PRODUCT_DISABLE', 'name' => 'Disable products'],
            ['code' => 'PRODUCT_DELETE', 'name' => 'Delete products (permanent)'],
            ['code' => 'PRICE_VIEW', 'name' => 'View prices'],
            ['code' => 'PRICE_PROPOSE', 'name' => 'Propose price changes'],
            ['code' => 'PRICE_APPROVE', 'name' => 'Approve price changes'],

            // Inventory core
            ['code' => 'INVENTORY_VIEW', 'name' => 'View inventory balances'],
            ['code' => 'LEDGER_VIEW', 'name' => 'View stock ledger'],

            // Purchasing / Receiving
            ['code' => 'PO_VIEW', 'name' => 'View purchase orders'],
            ['code' => 'PO_CREATE', 'name' => 'Create purchase orders'],
            ['code' => 'PO_APPROVE', 'name' => 'Approve purchase orders'],
            ['code' => 'PO_RECEIVE', 'name' => 'Receive purchase orders'],
            ['code' => 'SUPPLIER_VIEW', 'name' => 'View suppliers'],
            ['code' => 'SUPPLIER_MANAGE', 'name' => 'Create/update/deactivate suppliers'],

            // Sales / Cashier
            ['code' => 'SALES_VIEW', 'name' => 'View sales'],
            ['code' => 'SALES_CREATE', 'name' => 'Create sales'],
            ['code' => 'SALES_POST', 'name' => 'Post sales'],
            ['code' => 'SALES_VOID_REQUEST', 'name' => 'Request sale void'],
            ['code' => 'SALES_VOID', 'name' => 'Void sales'],
            ['code' => 'SALES_PAYMENT', 'name' => 'Receive sale payments'],

            // Expenses
            ['code' => 'EXPENSE_VIEW', 'name' => 'View expenses'],
            ['code' => 'EXPENSE_CREATE', 'name' => 'Create expenses'],
            ['code' => 'EXPENSE_UPDATE', 'name' => 'Update expenses'],
            ['code' => 'EXPENSE_VOID', 'name' => 'Void expenses'],

            // Transfers
            ['code' => 'TRANSFER_VIEW', 'name' => 'View transfers'],
            ['code' => 'TRANSFER_CREATE', 'name' => 'Create transfer requests'],
            ['code' => 'TRANSFER_APPROVE', 'name' => 'Approve transfers'],
            ['code' => 'TRANSFER_DISPATCH', 'name' => 'Dispatch transfers'],
            ['code' => 'TRANSFER_RECEIVE', 'name' => 'Receive transfers'],

            // Adjustments & Counts
            ['code' => 'ADJUSTMENT_VIEW', 'name' => 'View adjustments'],
            ['code' => 'ADJUSTMENT_CREATE', 'name' => 'Create adjustments'],
            ['code' => 'ADJUSTMENT_SUBMIT', 'name' => 'Submit adjustments'],
            ['code' => 'ADJUSTMENT_APPROVE', 'name' => 'Approve adjustments'],
            ['code' => 'ADJUSTMENT_POST', 'name' => 'Post adjustments'],
            ['code' => 'COUNT_VIEW', 'name' => 'View stock counts'],
            ['code' => 'COUNT_CREATE', 'name' => 'Create stock counts'],
            ['code' => 'COUNT_APPROVE', 'name' => 'Approve stock counts'],
            ['code' => 'COUNT_POST', 'name' => 'Post stock counts'],

            // Reports
            ['code' => 'REPORT_VIEW', 'name' => 'View reports'],
            ['code' => 'REPORT_EXPORT', 'name' => 'Export reports'],
        ];

        // Upsert permissions
        foreach ($permissions as $p) {
            Permission::updateOrCreate(['code' => $p['code']], ['name' => $p['name']]);
        }

        // Roles (current model: Admin, Inventory Clerk, Cashier)
        $roles = [
            ['code' => 'ADMIN', 'name' => 'Admin'],
            ['code' => 'CLERK', 'name' => 'Inventory Clerk'],
            ['code' => 'CASHIER', 'name' => 'Cashier'],
        ];

        foreach ($roles as $r) {
            Role::updateOrCreate(['code' => $r['code']], ['name' => $r['name']]);
        }

        // Migrate legacy role assignments before removing old roles.
        $adminRole = Role::where('code', 'ADMIN')->firstOrFail();
        $clerkRole = Role::where('code', 'CLERK')->firstOrFail();

        $ownerRole = Role::where('code', 'OWNER')->first();
        if ($ownerRole) {
            $ownerRole->users()->update(['role_id' => $adminRole->id]);
        }

        $managerRole = Role::where('code', 'MANAGER')->first();
        if ($managerRole) {
            $managerRole->users()->update(['role_id' => $clerkRole->id]);
        }

        Role::whereIn('code', ['OWNER', 'MANAGER', 'AUDITOR'])->delete();

        // Helper to attach permissions by codes
        $attach = function (string $roleCode, array $permCodes) {
            $role = Role::where('code', $roleCode)->firstOrFail();
            $permIds = Permission::whereIn('code', $permCodes)->pluck('id');
            $role->permissions()->sync($permIds);
        };

        // ADMIN: all permissions except staff clock-in/out actions.
        $attach(
            'ADMIN',
            Permission::query()
                ->where('code', '!=', 'STAFF_ATTENDANCE_CLOCK')
                ->pluck('code')
                ->all()
        );

        // CLERK: manager-like operations without approval powers
        $attach('CLERK', [
            'BRANCH_VIEW',
            'STAFF_ATTENDANCE_VIEW', 'STAFF_ATTENDANCE_CLOCK',
            'PRODUCT_VIEW', 'PRODUCT_CREATE', 'PRODUCT_UPDATE', 'PRICE_VIEW',
            'INVENTORY_VIEW', 'LEDGER_VIEW',
            'PO_VIEW', 'PO_CREATE', 'PO_RECEIVE',
            'SALES_VIEW', 'SALES_CREATE', 'SALES_POST', 'SALES_VOID_REQUEST', 'SALES_PAYMENT',
            'EXPENSE_VIEW', 'EXPENSE_CREATE', 'EXPENSE_UPDATE', 'EXPENSE_VOID',
            'SUPPLIER_VIEW', 'SUPPLIER_MANAGE',
            'TRANSFER_VIEW', 'TRANSFER_CREATE', 'TRANSFER_DISPATCH', 'TRANSFER_RECEIVE',
            'ADJUSTMENT_VIEW', 'ADJUSTMENT_CREATE', 'ADJUSTMENT_SUBMIT', 'ADJUSTMENT_APPROVE', 'ADJUSTMENT_POST',
            'COUNT_VIEW', 'COUNT_CREATE', 'COUNT_POST',
            'REPORT_VIEW', 'REPORT_EXPORT',
        ]);

        // CASHIER
        $attach('CASHIER', [
            'PRODUCT_VIEW',
            'STAFF_ATTENDANCE_VIEW', 'STAFF_ATTENDANCE_CLOCK',
            'SALES_VIEW', 'SALES_CREATE', 'SALES_POST', 'SALES_VOID_REQUEST', 'SALES_PAYMENT',
        ]);

    }
}
