import { Navigate, Route, Routes } from 'react-router-dom';
import { ProtectedRoute } from '../auth/ProtectedRoute';
import { RequirePermission } from '../auth/RequirePermission';
import { HomeRedirect } from '../auth/HomeRedirect';
import { AppShell } from '../layout/AppShell';
import { InventoryPage } from '../pages/InventoryPage';
import { LedgerPage } from '../pages/LedgerPage';
import { LoginPage } from '../pages/LoginPage';
import { VariantsPage } from '../pages/VariantsPage';
import { AdjustmentsPage } from '../pages/AdjustmentsPage';
import { TransfersPage } from '../pages/TransfersPage';
import { PurchaseOrdersPage } from '../pages/PurchaseOrdersPage';
import { SuppliersPage } from '../pages/SuppliersPage';
import { AccountsPage } from '../pages/AccountsPage';
import { ProductsPage } from '../pages/ProductsPage';
import { BranchesPage } from '../pages/BranchesPage';

export function AppRouter() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />

      <Route element={<ProtectedRoute />}>
        <Route element={<AppShell />}>
          {/* ✅ role-aware landing */}
          <Route index element={<HomeRedirect />} />

          <Route
            path="/inventory"
            element={
              <RequirePermission perm="INVENTORY_VIEW">
                <InventoryPage />
              </RequirePermission>
            }
          />
          <Route
            path="/products"
            element={
              <RequirePermission perm="PRODUCT_VIEW">
                <ProductsPage />
              </RequirePermission>
            }
          />
          <Route
            path="/variants"
            element={
              <RequirePermission perm="PRODUCT_VIEW">
                <VariantsPage />
              </RequirePermission>
            }
          />
          <Route
            path="/adjustments"
            element={
              <RequirePermission perm="ADJUSTMENT_VIEW">
                <AdjustmentsPage />
              </RequirePermission>
            }
          />
          <Route
            path="/transfers"
            element={
              <RequirePermission perm="TRANSFER_VIEW">
                <TransfersPage />
              </RequirePermission>
            }
          />
          <Route
            path="/purchase-orders"
            element={
              <RequirePermission perm="PO_VIEW">
                <PurchaseOrdersPage />
              </RequirePermission>
            }
          />
          <Route
            path="/suppliers"
            element={
              <RequirePermission perm="SUPPLIER_VIEW">
                <SuppliersPage />
              </RequirePermission>
            }
          />
          <Route
            path="/accounts"
            element={
              <RequirePermission perm="USER_VIEW">
                <AccountsPage />
              </RequirePermission>
            }
          />
          <Route
            path="/branches"
            element={
              <RequirePermission perm="BRANCH_MANAGE">
                <BranchesPage />
              </RequirePermission>
            }
          />
          <Route
            path="/ledger"
            element={
              <RequirePermission perm="LEDGER_VIEW">
                <LedgerPage />
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
