import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { ApiError } from '../../api/apiFetch';
import {
  listMySessions,
  revokeMyOtherSessions,
  revokeMySession,
} from '../../api/endpoints/account';
import { logoutAll } from '../../api/endpoints/auth';
import { queryKeys } from '../../api/queryKeys';
import type { SessionResponse } from '../../api/types';
import { completeSignOut } from '../../auth/session';
import { ConfirmDialog } from '../../components/ConfirmDialog';
import { QueryError } from '../../components/ProblemAlert';
import { SessionsTable } from '../../components/SessionsTable';
import { describeUserAgent } from '../../lib/userAgent';
import { showToast } from '../../lib/toast';

type Pending =
  { kind: 'revoke'; session: SessionResponse } | { kind: 'others' } | { kind: 'everywhere' } | null;

export function SessionsPage() {
  const queryClient = useQueryClient();
  const [pending, setPending] = useState<Pending>(null);
  const sessions = useQuery({
    queryKey: queryKeys.mySessions,
    queryFn: ({ signal }) => listMySessions(signal),
  });

  const refresh = () => queryClient.invalidateQueries({ queryKey: queryKeys.mySessions });

  const revoke = useMutation({
    mutationFn: (s: SessionResponse) => revokeMySession(s.id),
    onSuccess: (_, s) => {
      if (s.isCurrent) {
        // Revoking this device's session is the same as signing out.
        completeSignOut();
        return;
      }
      setPending(null);
      showToast('Session signed out.', 'success');
      void refresh();
    },
    onError: (err) => {
      if (err instanceof ApiError && err.status === 404) {
        // Already gone (expired or revoked elsewhere).
        setPending(null);
        void refresh();
      }
    },
  });

  const others = useMutation({
    mutationFn: revokeMyOtherSessions,
    onSuccess: ({ revoked }) => {
      setPending(null);
      showToast(`${revoked} ${revoked === 1 ? 'session' : 'sessions'} signed out.`, 'success');
      void refresh();
    },
  });

  const everywhere = useMutation({
    mutationFn: logoutAll,
    onSuccess: () => completeSignOut(),
  });

  const otherCount = sessions.data?.filter((s) => !s.isCurrent).length ?? 0;
  const activeMutation =
    pending?.kind === 'revoke' ? revoke : pending?.kind === 'others' ? others : everywhere;

  function close() {
    setPending(null);
    revoke.reset();
    others.reset();
    everywhere.reset();
  }

  return (
    <section className="page">
      <h1>My sessions</h1>
      <div className="toolbar">
        <button
          type="button"
          className="btn"
          disabled={otherCount === 0}
          onClick={() => setPending({ kind: 'others' })}
        >
          Sign out all other sessions
        </button>
        <button
          type="button"
          className="btn btn-danger"
          onClick={() => setPending({ kind: 'everywhere' })}
        >
          Sign out everywhere
        </button>
      </div>
      {sessions.isError ? (
        <QueryError error={sessions.error} onRetry={() => void sessions.refetch()} />
      ) : (
        <SessionsTable
          caption="Your active sessions"
          sessions={sessions.data}
          isLoading={sessions.isPending}
          onRevoke={(session) => setPending({ kind: 'revoke', session })}
        />
      )}
      <p className="muted note">
        You can be signed in on up to 5 devices. Signing in on a 6th signs out the oldest.
      </p>

      <ConfirmDialog
        open={pending !== null}
        title={
          pending?.kind === 'revoke'
            ? 'Revoke session?'
            : pending?.kind === 'others'
              ? 'Sign out all other sessions?'
              : 'Sign out everywhere?'
        }
        confirmLabel={pending?.kind === 'revoke' ? 'Revoke' : 'Sign out'}
        destructive
        pending={activeMutation.isPending}
        error={activeMutation.error}
        onCancel={close}
        onConfirm={() => {
          if (pending?.kind === 'revoke') revoke.mutate(pending.session);
          else if (pending?.kind === 'others') others.mutate();
          else everywhere.mutate();
        }}
      >
        {pending?.kind === 'revoke' && (
          <p>
            Sign out <strong>{describeUserAgent(pending.session.userAgent)}</strong>
            {pending.session.ipAddress ? ` (${pending.session.ipAddress})` : ''}
            {pending.session.isCurrent
              ? '? This is the device you are using now, so you will be signed out.'
              : '?'}
          </p>
        )}
        {pending?.kind === 'others' && (
          <p>
            This signs out your {otherCount} other {otherCount === 1 ? 'session' : 'sessions'}. This
            device stays signed in.
          </p>
        )}
        {pending?.kind === 'everywhere' && <p>This signs out every session, including this one.</p>}
      </ConfirmDialog>
    </section>
  );
}
