import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { userAction, type UserAction } from '../../../api/endpoints/admin';
import { queryKeys } from '../../../api/queryKeys';
import type { UserSummary } from '../../../api/types';
import { ConfirmDialog } from '../../../components/ConfirmDialog';
import { showToast } from '../../../lib/toast';

const COPY: Record<
  UserAction,
  { title: string; confirm: string; done: string; destructive: boolean }
> = {
  disable: {
    title: 'Disable user?',
    confirm: 'Disable',
    done: 'User disabled.',
    destructive: true,
  },
  enable: { title: 'Enable user?', confirm: 'Enable', done: 'User enabled.', destructive: false },
  unlock: { title: 'Unlock user?', confirm: 'Unlock', done: 'User unlocked.', destructive: false },
};

export function UserAccountActions({ user, isSelf }: { user: UserSummary; isSelf: boolean }) {
  const queryClient = useQueryClient();
  const [action, setAction] = useState<UserAction | null>(null);

  const mutation = useMutation({
    mutationFn: (a: UserAction) => userAction(user.id, a),
    onSuccess: (_, a) => {
      setAction(null);
      showToast(COPY[a].done, 'success');
      void queryClient.invalidateQueries({ queryKey: queryKeys.user(user.id) });
      void queryClient.invalidateQueries({ queryKey: queryKeys.usersAll });
    },
  });

  // The backend refuses self-disable (400); don't offer it.
  const canDisable = !user.isDisabled && !isSelf;

  return (
    <div className="card">
      <h2>Account actions</h2>
      <div className="toolbar">
        {canDisable && (
          <button type="button" className="btn btn-danger" onClick={() => setAction('disable')}>
            Disable
          </button>
        )}
        {user.isDisabled && (
          <button type="button" className="btn" onClick={() => setAction('enable')}>
            Enable
          </button>
        )}
        {user.isLockedOut && (
          <button type="button" className="btn" onClick={() => setAction('unlock')}>
            Unlock
          </button>
        )}
        {!canDisable && !user.isDisabled && !user.isLockedOut && (
          <p className="muted">
            {isSelf ? 'You cannot disable your own account.' : 'No actions available.'}
          </p>
        )}
      </div>

      <ConfirmDialog
        open={action !== null}
        title={action ? COPY[action].title : ''}
        confirmLabel={action ? COPY[action].confirm : ''}
        destructive={action ? COPY[action].destructive : false}
        pending={mutation.isPending}
        error={mutation.error}
        onCancel={() => {
          setAction(null);
          mutation.reset();
        }}
        onConfirm={() => action && mutation.mutate(action)}
      >
        {action === 'disable' && (
          <p>
            Disable <strong>{user.email}</strong>? This immediately signs the user out everywhere.
          </p>
        )}
        {action === 'enable' && (
          <p>
            Enable <strong>{user.email}</strong>? They will be able to sign in again.
          </p>
        )}
        {action === 'unlock' && (
          <p>
            Unlock <strong>{user.email}</strong>? This clears the lockout and failed-login count.
          </p>
        )}
      </ConfirmDialog>
    </div>
  );
}
