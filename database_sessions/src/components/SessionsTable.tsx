import type { SessionResponse } from '../api/types';
import { describeUserAgent } from '../lib/userAgent';
import { EmptyState, TableSkeleton } from './Loaders';
import { DateTime, Tooltip } from './Tooltip';

type Props = {
  sessions: SessionResponse[] | undefined;
  isLoading: boolean;
  /** Omit to render without revoke buttons (e.g. missing sessions.revoke). */
  onRevoke?: (session: SessionResponse) => void;
  /** Label the current session as "This device" (only meaningful for the caller's own list). */
  markCurrent?: boolean;
  caption: string;
};

export function SessionsTable({
  sessions,
  isLoading,
  onRevoke,
  markCurrent = true,
  caption,
}: Props) {
  if (isLoading) return <TableSkeleton columns={onRevoke ? 7 : 6} />;
  if (!sessions || sessions.length === 0) return <EmptyState>No active sessions.</EmptyState>;

  return (
    <div className="table-wrap">
      <table className="table">
        <caption className="visually-hidden">{caption}</caption>
        <thead>
          <tr>
            <th scope="col">Device</th>
            <th scope="col">IP</th>
            <th scope="col">Created</th>
            <th scope="col">Last seen</th>
            <th scope="col">Idle expiry</th>
            <th scope="col">Absolute expiry</th>
            {onRevoke && (
              <th scope="col">
                <span className="visually-hidden">Actions</span>
              </th>
            )}
          </tr>
        </thead>
        <tbody>
          {sessions.map((s) => (
            <tr key={s.id}>
              <td>
                <Tooltip text={s.userAgent ?? 'No user agent recorded'}>
                  {describeUserAgent(s.userAgent)}
                </Tooltip>
                {markCurrent && s.isCurrent && (
                  <span className="badge badge-info">This device</span>
                )}
              </td>
              <td>{s.ipAddress ?? <span className="muted">—</span>}</td>
              <td>
                <DateTime iso={s.createdUtc} />
              </td>
              <td>
                <DateTime iso={s.lastSeenUtc} />
              </td>
              <td>
                <DateTime iso={s.idleExpiresUtc} />
              </td>
              <td>
                <DateTime iso={s.absoluteExpiresUtc} />
              </td>
              {onRevoke && (
                <td className="cell-actions">
                  <button
                    type="button"
                    className="btn btn-small btn-danger"
                    onClick={() => onRevoke(s)}
                  >
                    Revoke
                    <span className="visually-hidden">
                      {' '}
                      session {describeUserAgent(s.userAgent)}
                    </span>
                  </button>
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
