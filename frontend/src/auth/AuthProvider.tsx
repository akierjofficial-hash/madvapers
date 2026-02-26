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
import { useMeQuery, qk } from '../api/queries';
import { api } from '../lib/http';
import type { User } from '../types/models';

type AuthContextValue = {
  token: string | null;
  user: User | null;
  permissions: string[];
  can: (perm: string) => boolean;
  isLoadingUser: boolean;
  setToken: (token: string | null) => void;
  logout: () => void;
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [token, setTokenState] = useState<string | null>(() => authStorage.getToken());

  const meQuery = useMeQuery(!!token);
  const user = meQuery.data?.user ?? null;

  const permissions = meQuery.data?.permissions ?? [];
  const can = useCallback((perm: string) => permissions.includes(perm), [permissions]);

  const setToken = (next: string | null) => {
    setTokenState(next);
    if (next) authStorage.setToken(next);
    else authStorage.clearToken();
  };

  const clearClientSession = useCallback(() => {
    authStorage.clearToken();
    authStorage.clearLastBranchId();
    setTokenState(null);
    qc.clear();
  }, [qc]);

  const logout = () => {
    const t = token;

    // Best-effort revoke on server (don’t block UI logout if it fails)
    if (t) {
      api
        .post('/auth/logout', null, {
          headers: { Authorization: `Bearer ${t}` },
        })
        .catch(() => {});
    }

    clearClientSession();
    qc.removeQueries({ queryKey: qk.me });

    navigate('/login', { replace: true });
  };

  useEffect(() => {
    const onUnauthorized = () => {
      clearClientSession();
      navigate('/login', { replace: true });
    };

    window.addEventListener('auth:unauthorized', onUnauthorized);
    return () => window.removeEventListener('auth:unauthorized', onUnauthorized);
  }, [navigate, clearClientSession]);

  // If token exists but /me fails (e.g. revoked), bounce to login
  useEffect(() => {
    if (token && meQuery.isError) {
      logout();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, meQuery.isError]);

  const value = useMemo<AuthContextValue>(
    () => ({
      token,
      user,
      permissions,
      can,
      isLoadingUser: !!token && meQuery.isLoading,
      setToken,
      logout,
    }),
    [token, user, permissions, can, meQuery.isLoading]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
