import { useQuery } from '@tanstack/react-query';
import type { MeResponse, Permission } from '../api/types';
import { meQueryOptions } from './session';

export function useMe() {
  return useQuery(meQueryOptions);
}

/** The signed-in user. Only call below <RequireAuth>, where `['me']` is guaranteed to be loaded. */
export function useCurrentUser(): MeResponse {
  const { data } = useMe();
  if (!data) throw new Error('useCurrentUser() used outside <RequireAuth>');
  return data;
}

/** UI-only check to hide controls that would fail. The backend is the authority. */
export function useHasPermission(permission: Permission): boolean {
  const { data } = useMe();
  return !!data?.permissions.includes(permission);
}
