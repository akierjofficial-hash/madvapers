import { Alert } from '@mui/material';
import { Navigate } from 'react-router-dom';
import { useAuth } from './AuthProvider';

export function HomeRedirect() {
  const { isAuthenticated, isLoadingUser, user, can } = useAuth();

  if (isLoadingUser) return <Alert severity="info">Loading…</Alert>;
  if (!isAuthenticated) return <Navigate to="/login" replace />;

  const role = user?.role?.code ?? '';

  // Role-specific preference (small but meaningful)
  if (role === 'AUDITOR' && can('LEDGER_VIEW')) {
    return <Navigate to="/ledger" replace />;
  }

  // Default priority by capability
  if (can('USER_VIEW')) return <Navigate to="/dashboard" replace />;
  if (can('INVENTORY_VIEW')) return <Navigate to="/inventory" replace />;
  if (can('LEDGER_VIEW')) return <Navigate to="/ledger" replace />;
  if (can('PO_VIEW')) return <Navigate to="/purchase-orders" replace />;
  if (can('TRANSFER_VIEW')) return <Navigate to="/transfers" replace />;
  if (can('ADJUSTMENT_VIEW')) return <Navigate to="/adjustments" replace />;
  if (can('PRODUCT_VIEW')) return <Navigate to="/products" replace />;
  if (can('SUPPLIER_VIEW')) return <Navigate to="/suppliers" replace />;
  if (can('USER_VIEW')) return <Navigate to="/accounts" replace />;

  return <Alert severity="error">No accessible modules for your account.</Alert>;
}
