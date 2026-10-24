import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import {
  listUserSessions,
  revokeAllUserSessions,
  revokeSession,
} from '../../../api/endpoints/admin';
import { ApiError } from '../../../api/apiFetch';
import { queryKeys } from '../../../api/queryKeys';
import type { SessionResponse } from '../../../api/types';
import { completeSignOut } from '../../../auth/session';
import { ConfirmDialog } from '../../../components/ConfirmDialog';
import { QueryError } from '../../../components/ProblemAlert';
import { SessionsTable } from '../../../components/SessionsTable';
import { describeUserAgent } from '../../../lib/userAgent';
import { showToast } from '../../../lib/toast';

type Pending = { kind: 'one'; session: SessionResponse } | { kind: 'all' } | null;

export function UserSessionsPanel({
  userId,
  email,
  canRevoke,
}: {
  userId: string;
  email: string;
  canRevoke: boolean;
}) {
  const queryClient = useQueryClient();
  const [pending, setPending] = useState<Pending>(null);
  const sessions = useQuery({
    queryKey: queryKeys.userSessions(userId),
    queryFn: ({ signal }) => listUserSessions(userId, signal),
  });
  const refresh = () => queryClient.invalidateQueries({ queryKey: queryKeys.userSessions(userId) });

  const revokeOne = useMutation({
    mutationFn: (s: SessionResponse) => revokeSession(s.id),
    onSuccess: (_, s) => {
      // An admin viewing their own record may revoke the session they are using.
      if (s.isCurrent) return completeSignOut();
      setPending(null);
      showToast('Session revoked.', 'success');
      void refresh();
    },
    onError: (err) => {
      if (err instanceof ApiError && err.status === 404) {
        setPending(null);
        void refresh();
      }
    },
  });

  const revokeAll = useMutation({
    mutationFn: () => revokeAllUserSessions(userId),
    onSuccess: ({ revoked }) => {
      setPending(null);
      showToast(`${revoked} ${revoked === 1 ? 'session' : 'sessions'} revoked.`, 'success');
      void refresh();
      // If this was the admin's own record, their current session is gone too; /me will notice.
      void queryClient.invalidateQueries({ queryKey: queryKeys.me });
    },
  });

  const active = pending?.kind === 'one' ? revokeOne : revokeAll;

  return (
    <div className="card">
      <div className="card-header">
        <h2>Sessions</h2>
        {canRevoke && (sessions.data?.length ?? 0) > 0 && (
          <button
            type="button"
            className="btn btn-danger"
            onClick={() => setPending({ kind: 'all' })}
          >
            Revoke all
          </button>
        )}
      </div>
      {sessions.isError ? (
        <QueryError error={sessions.error} onRetry={() => void sessions.refetch()} />
      ) : (
        <SessionsTable
          caption={`Active sessions for ${email}`}
          sessions={sessions.data}
          isLoading={sessions.isPending}
          onRevoke={canRevoke ? (session) => setPending({ kind: 'one', session }) : undefined}
        />
      )}

      <ConfirmDialog
        open={pending !== null}
        title={pending?.kind === 'one' ? 'Revoke session?' : 'Revoke all sessions?'}
        confirmLabel={pending?.kind === 'one' ? 'Revoke' : 'Revoke all'}
        destructive
        pending={active.isPending}
        error={active.error}
        onCancel={() => {
          setPending(null);
          revokeOne.reset();
          revokeAll.reset();
        }}
        onConfirm={() => {
          if (pending?.kind === 'one') revokeOne.mutate(pending.session);
          else revokeAll.mutate();
        }}
      >
        {pending?.kind === 'one' ? (
          <p>
            Revoke the <strong>{describeUserAgent(pending.session.userAgent)}</strong> session of{' '}
            <strong>{email}</strong>? They will be signed out on that device.
          </p>
        ) : (
          <p>
            Revoke every session of <strong>{email}</strong>? They will be signed out everywhere.
          </p>
        )}
      </ConfirmDialog>
    </div>
  );
}
