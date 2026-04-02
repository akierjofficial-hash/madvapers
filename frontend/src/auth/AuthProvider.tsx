import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { authStorage } from './authStorage';
import { tokenStorage } from './tokenStorage';
import { useMeQuery, qk } from '../api/queries';
import { logout as apiLogout } from '../api/auth';
import type { User } from '../types/models';

type AuthContextValue = {
  isAuthenticated: boolean;
  user: User | null;
  permissions: string[];
  can: (perm: string) => boolean;
  isLoadingUser: boolean;
  isLoggingOut: boolean;
  logout: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  const meQuery = useMeQuery(!isLoggingOut);
  const user = meQuery.data?.user ?? null;
  const isAuthenticated = !!user;

  const permissions = meQuery.data?.permissions ?? [];
  const can = useCallback((perm: string) => permissions.includes(perm), [permissions]);

  const clearClientSession = useCallback(() => {
    authStorage.clearLastBranchId();
    tokenStorage.clear();
    qc.clear();
  }, [qc]);

  const logout = useCallback(async () => {
    if (isLoggingOut) return;
    setIsLoggingOut(true);

    // Wait for server-side session invalidation before redirecting.
    try {
      await apiLogout();
    } catch {
      // Continue client-side cleanup even if server logout fails.
    }

    clearClientSession();
    qc.removeQueries({ queryKey: qk.me });
    navigate('/login', { replace: true });
    setIsLoggingOut(false);
  }, [clearClientSession, navigate, qc, isLoggingOut]);

  useEffect(() => {
    const onUnauthorized = () => {
      clearClientSession();
      navigate('/login', { replace: true });
    };

    window.addEventListener('auth:unauthorized', onUnauthorized);
    return () => window.removeEventListener('auth:unauthorized', onUnauthorized);
  }, [navigate, clearClientSession]);

  const value = useMemo<AuthContextValue>(
    () => ({
      isAuthenticated,
      user,
      permissions,
      can,
      isLoadingUser: !isLoggingOut && meQuery.isLoading,
      isLoggingOut,
      logout,
    }),
    [isAuthenticated, user, permissions, can, meQuery.isLoading, isLoggingOut, logout]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
