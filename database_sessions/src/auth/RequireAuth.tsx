import type { ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { FullPageLoader } from '../components/Loaders';
import { QueryError } from '../components/ProblemAlert';
import { loginPathWithReturn } from '../lib/returnTo';
import { useMe } from './useMe';

export function RequireAuth({ children }: { children: ReactNode }) {
  const location = useLocation();
  const me = useMe();

  if (me.isPending) return <FullPageLoader />;
  if (me.isError && me.data === undefined) {
    return (
      <main className="center-page">
        <QueryError error={me.error} onRetry={() => void me.refetch()} />
      </main>
    );
  }
  if (!me.data) {
    return <Navigate to={loginPathWithReturn(location.pathname + location.search)} replace />;
  }
  return <>{children}</>;
}
