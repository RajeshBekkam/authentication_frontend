import type { ReactNode } from 'react';
import type { Permission } from '../api/types';
import { ForbiddenPage } from '../features/errors/ErrorPages';
import { useHasPermission } from './useMe';

/** Renders a 403 page (not a login redirect) when the permission is missing. */
export function RequirePermission({ perm, children }: { perm: Permission; children: ReactNode }) {
  const allowed = useHasPermission(perm);
  return allowed ? <>{children}</> : <ForbiddenPage />;
}
