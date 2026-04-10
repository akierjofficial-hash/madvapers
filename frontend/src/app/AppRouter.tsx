import { Navigate, Route, Routes } from 'react-router-dom';
import { ProtectedRoute } from '../auth/ProtectedRoute';
import { RequirePermission } from '../auth/RequirePermission';
import { HomeRedirect } from '../auth/HomeRedirect';
import { AppShell } from '../layout/AppShell';
import { InventoryPage } from '../pages/InventoryPage';
import { LedgerPage } from '../pages/LedgerPage';
import { StockHistoryPage } from '../pages/StockHistoryPage';
import { LoginPage } from '../pages/LoginPage';
import { VariantsPage } from '../pages/VariantsPage';
import { AdjustmentsPage } from '../pages/AdjustmentsPage';
import { TransfersPage } from '../pages/TransfersPage';
import { PurchaseOrdersPage } from '../pages/PurchaseOrdersPage';
import { SuppliersPage } from '../pages/SuppliersPage';
import { AccountsPage } from '../pages/AccountsPage';
import { ProductsPage } from '../pages/ProductsPage';
import { BranchesPage } from '../pages/BranchesPage';
import { DashboardPage } from '../pages/DashboardPage';
import { AnalyticsPage } from '../pages/AnalyticsPage';
import { ApprovalsPage } from '../pages/ApprovalsPage';
import { SalesPage } from '../pages/SalesPage';
import { ExpensesPage } from '../pages/ExpensesPage';
import { AuditLogsPage } from '../pages/AuditLogsPage';
import { StaffAttendancePage } from '../pages/StaffAttendancePage';
import { AttendancePage } from '../pages/AttendancePage';
import { InactiveItemsPage } from '../pages/InactiveItemsPage';

export function AppRouter() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />

      <Route element={<ProtectedRoute />}>
        <Route element={<AppShell />}>
          {/* ✅ role-aware landing */}
          <Route index element={<HomeRedirect />} />

          <Route
            path="/dashboard"
            element={
              <RequirePermission perm="USER_VIEW" denyRoleCodes={['CASHIER']}>
                <DashboardPage />
              </RequirePermission>
            }
          />
          <Route
            path="/analytics"
            element={
              <RequirePermission perm="USER_VIEW" allowRoleCodes={['ADMIN']}>
                <AnalyticsPage />
              </RequirePermission>
            }
          />
          <Route
            path="/approvals"
            element={
              <RequirePermission perm="USER_VIEW" denyRoleCodes={['CASHIER']}>
                <ApprovalsPage />
              </RequirePermission>
            }
          />

          <Route
            path="/inventory"
            element={
              <RequirePermission perm="INVENTORY_VIEW" denyRoleCodes={['CASHIER']}>
                <InventoryPage />
              </RequirePermission>
            }
          />
          <Route
            path="/products"
            element={
              <RequirePermission perm="PRODUCT_VIEW" denyRoleCodes={['CASHIER']}>
                <ProductsPage />
              </RequirePermission>
            }
          />
          <Route
            path="/variants"
            element={
              <RequirePermission perm="PRODUCT_VIEW" denyRoleCodes={['CASHIER']}>
                <VariantsPage />
              </RequirePermission>
            }
          />
          <Route
            path="/adjustments"
            element={
              <RequirePermission perm="ADJUSTMENT_VIEW" denyRoleCodes={['CASHIER']}>
                <AdjustmentsPage />
              </RequirePermission>
            }
          />
          <Route
            path="/transfers"
            element={
              <RequirePermission perm="TRANSFER_VIEW" denyRoleCodes={['CASHIER']}>
                <TransfersPage />
              </RequirePermission>
            }
          />
          <Route
            path="/purchase-orders"
            element={
              <RequirePermission perm="PO_VIEW" denyRoleCodes={['CASHIER']}>
                <PurchaseOrdersPage />
              </RequirePermission>
            }
          />
          <Route
            path="/sales"
            element={
              <RequirePermission perm="SALES_VIEW">
                <SalesPage />
              </RequirePermission>
            }
          />
          <Route
            path="/expenses"
            element={
              <RequirePermission perm="EXPENSE_VIEW" denyRoleCodes={['CASHIER']}>
                <ExpensesPage />
              </RequirePermission>
            }
          />
          <Route
            path="/suppliers"
            element={
              <RequirePermission perm="SUPPLIER_VIEW" denyRoleCodes={['CASHIER']}>
                <SuppliersPage />
              </RequirePermission>
            }
          />
          <Route
            path="/accounts"
            element={
              <RequirePermission perm="USER_VIEW" denyRoleCodes={['CASHIER']}>
                <AccountsPage />
              </RequirePermission>
            }
          />
          <Route
            path="/staff-attendance"
            element={
              <RequirePermission perm="STAFF_ATTENDANCE_VIEW" allowRoleCodes={['ADMIN']}>
                <StaffAttendancePage />
              </RequirePermission>
            }
          />
          <Route
            path="/attendance"
            element={
              <RequirePermission perm="STAFF_ATTENDANCE_VIEW" allowRoleCodes={['CLERK', 'CASHIER']}>
                <AttendancePage />
              </RequirePermission>
            }
          />
          <Route
            path="/branches"
            element={
              <RequirePermission perm="BRANCH_MANAGE" denyRoleCodes={['CASHIER']}>
                <BranchesPage />
              </RequirePermission>
            }
          />
          <Route
            path="/ledger"
            element={
              <RequirePermission perm="LEDGER_VIEW" denyRoleCodes={['CASHIER']}>
                <LedgerPage />
              </RequirePermission>
            }
          />
          <Route
            path="/stock-history"
            element={
              <RequirePermission perm="INVENTORY_VIEW" denyRoleCodes={['CASHIER']}>
                <StockHistoryPage />
              </RequirePermission>
            }
          />
          <Route
            path="/inactive-items"
            element={
              <RequirePermission perm="PRODUCT_VIEW" denyRoleCodes={['CASHIER']}>
                <InactiveItemsPage />
              </RequirePermission>
            }
          />
          <Route
            path="/audit-logs"
            element={
              <RequirePermission perm="AUDIT_VIEW" denyRoleCodes={['CASHIER']}>
                <AuditLogsPage />
              </RequirePermission>
            }
          />
        </Route>
      </Route>

      {/* ✅ unknown routes go to HomeRedirect */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
