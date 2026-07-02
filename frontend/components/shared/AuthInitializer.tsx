'use client';

import { useEffect } from 'react';
import { useCurrentUser } from '@/hooks/useAuth';
import { useAuthStore } from '@/stores/auth.store';

/**
 * Mounted once near the app root. Resolves GET /auth/me on load and syncs
 * the result into useAuthStore, so every other component can keep reading
 * auth state synchronously from the store instead of each needing its own
 * useCurrentUser() call. Renders nothing.
 */
export function AuthInitializer() {
  const { data, isError, isFetched } = useCurrentUser();
  const setUser = useAuthStore((s) => s.setUser);
  const logout = useAuthStore((s) => s.logout);

  useEffect(() => {
    if (!isFetched) return;
    if (data) setUser(data);
    else if (isError) logout();
  }, [data, isError, isFetched, setUser, logout]);

  return null;
}
