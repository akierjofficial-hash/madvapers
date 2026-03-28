import { Alert } from '@mui/material';
import type { ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from './AuthProvider';

export function RequirePermission(props: {
  perm: string;
  children: ReactNode;
  mode?: 'redirect' | 'message';
  denyRoleCodes?: string[];
  allowRoleCodes?: string[];
}) {
  const { isAuthenticated, isLoadingUser, can, user } = useAuth();
  const location = useLocation();

  if (!isAuthenticated && !isLoadingUser) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }
  if (isLoadingUser) return <Alert severity="info">Loading...</Alert>;

  const roleCode = String(user?.role?.code ?? '').toUpperCase();
  const allowRoleCodes = (props.allowRoleCodes ?? []).map((code) => String(code).toUpperCase());
  if (allowRoleCodes.length > 0 && (!roleCode || !allowRoleCodes.includes(roleCode))) {
    return <Navigate to="/" replace />;
  }

  const denyRoleCodes = (props.denyRoleCodes ?? []).map((code) => String(code).toUpperCase());
  if (roleCode && denyRoleCodes.includes(roleCode)) {
    return <Navigate to="/" replace />;
  }

  if (!can(props.perm)) {
    if (props.mode === 'message') {
      return <Alert severity="error">Not authorized ({props.perm}).</Alert>;
    }
    // Send users to role-aware home instead of forcing inventory.
    return <Navigate to="/" replace />;
  }

  return <>{props.children}</>;
}
