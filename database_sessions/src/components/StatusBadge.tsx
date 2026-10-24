import type { UserSummary } from '../api/types';
import { formatTime } from '../lib/format';

export function UserStatusBadge({ user }: { user: UserSummary }) {
  if (user.isDisabled) return <span className="badge badge-danger">Disabled</span>;
  if (user.isLockedOut && user.lockoutEndUtc) {
    return (
      <span className="badge badge-warning">Locked until {formatTime(user.lockoutEndUtc)}</span>
    );
  }
  if (user.isLockedOut) return <span className="badge badge-warning">Locked</span>;
  return <span className="badge badge-success">Active</span>;
}
