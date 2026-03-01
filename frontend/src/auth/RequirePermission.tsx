import { Alert } from '@mui/material';
import type { ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from './AuthProvider';

export function RequirePermission(props: {
  perm: string;
  children: ReactNode;
  mode?: 'redirect' | 'message';
}) {
  const { isAuthenticated, isLoadingUser, can } = useAuth();
  const location = useLocation();

  if (!isAuthenticated && !isLoadingUser) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }
  if (isLoadingUser) return <Alert severity="info">Loading…</Alert>;

  if (!can(props.perm)) {
    if (props.mode === 'message') {
      return <Alert severity="error">Not authorized ({props.perm}).</Alert>;
    }
    // Send users to role-aware home instead of forcing inventory.
    return <Navigate to="/" replace />;
  }

  return <>{props.children}</>;
}
