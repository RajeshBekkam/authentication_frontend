import type { ReactNode } from 'react';
import { Navigate, useSearchParams } from 'react-router-dom';
import { FullPageLoader } from '../components/Loaders';
import { sanitizeReturnTo } from '../lib/returnTo';
import { useMe } from './useMe';

/**
 * /login and /register: signed-in users are sent on. This is also how a successful login leaves
 * the login page: once `['me']` is populated we redirect to the sanitized `returnTo`.
 */
export function RequireAnonymous({ children }: { children: ReactNode }) {
  const [params] = useSearchParams();
  const me = useMe();

  if (me.isPending) return <FullPageLoader />;
  if (me.data) return <Navigate to={sanitizeReturnTo(params.get('returnTo'))} replace />;
  return <>{children}</>;
}
