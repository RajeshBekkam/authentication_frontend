import { useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { queryKeys } from '../api/queryKeys';
import { ABSOLUTE_WARNING_MS, IDLE_WARNING_MS, useLastActivity, useNow } from '../auth/idleMonitor';
import { signOut } from '../auth/session';
import { formatTime } from '../lib/format';
import { ConfirmDialog } from './ConfirmDialog';

/**
 * PRD 6.2: informational only. The server enforces the 30-minute idle and 12-hour absolute limits;
 * these notices just warn the user before they hit them.
 */
export function SessionNotices({ absoluteExpiresUtc }: { absoluteExpiresUtc: string }) {
  const now = useNow(10_000);
  const lastActivity = useLastActivity();
  const queryClient = useQueryClient();
  const [pending, setPending] = useState(false);

  const idleWarning = now - lastActivity >= IDLE_WARNING_MS;
  const absoluteEnd = new Date(absoluteExpiresUtc).getTime();
  const nearAbsoluteEnd = absoluteEnd - now <= ABSOLUTE_WARNING_MS;

  async function staySignedIn() {
    setPending(true);
    try {
      // Any successful request slides the idle window; /me also confirms the session is still alive.
      await queryClient.refetchQueries({ queryKey: queryKeys.me });
    } finally {
      setPending(false);
    }
  }

  return (
    <>
      {nearAbsoluteEnd && (
        <div className="alert alert-warning" role="status">
          Your session ends at {formatTime(absoluteExpiresUtc)}. Save your work.
        </div>
      )}
      <ConfirmDialog
        open={idleWarning}
        title="Are you still there?"
        confirmLabel="Stay signed in"
        cancelLabel="Sign out"
        cancelOnEscape={false}
        pending={pending}
        onConfirm={() => void staySignedIn()}
        onCancel={() => void signOut()}
      >
        <p>You&apos;ll be signed out soon due to inactivity.</p>
      </ConfirmDialog>
    </>
  );
}
