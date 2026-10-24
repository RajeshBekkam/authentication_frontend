import { useQuery } from '@tanstack/react-query';
import { Link, useParams } from 'react-router-dom';
import { ApiError } from '../../../api/apiFetch';
import { getUser } from '../../../api/endpoints/admin';
import { queryKeys } from '../../../api/queryKeys';
import { PERMISSIONS } from '../../../api/types';
import { useCurrentUser } from '../../../auth/useMe';
import { TableSkeleton } from '../../../components/Loaders';
import { QueryError } from '../../../components/ProblemAlert';
import { UserStatusBadge } from '../../../components/StatusBadge';
import { DateTime } from '../../../components/Tooltip';
import { isGuid } from '../../../lib/format';
import { ResourceNotFound } from '../../errors/ErrorPages';
import { UserAccountActions } from './UserAccountActions';
import { UserRolesEditor } from './UserRolesEditor';
import { UserSessionsPanel } from './UserSessionsPanel';

export default function UserDetailPage() {
  const { id = '' } = useParams();
  const me = useCurrentUser();
  const can = (p: string) => me.permissions.includes(p);
  const validId = isGuid(id);

  const detail = useQuery({
    queryKey: queryKeys.user(id),
    queryFn: ({ signal }) => getUser(id, signal),
    enabled: validId,
  });

  const notFound = !validId || (detail.error instanceof ApiError && detail.error.status === 404);
  if (notFound)
    return <ResourceNotFound what="User" backTo="/admin/users" backLabel="Back to users" />;
  if (detail.isError)
    return <QueryError error={detail.error} onRetry={() => void detail.refetch()} />;
  if (detail.isPending) return <TableSkeleton rows={6} columns={2} />;

  const { user, roles, permissions, failedLoginCount, passwordChangedUtc } = detail.data;
  const isSelf = user.id === me.userId;

  return (
    <section className="page">
      <p>
        <Link to="/admin/users">← Users</Link>
      </p>
      <h1>{user.email}</h1>

      <div className="card">
        <dl className="details">
          <dt>Status</dt>
          <dd>
            <UserStatusBadge user={user} />
          </dd>
          <dt>Created</dt>
          <dd>
            <DateTime iso={user.createdUtc} />
          </dd>
          {user.disabledAtUtc && (
            <>
              <dt>Disabled at</dt>
              <dd>
                <DateTime iso={user.disabledAtUtc} />
              </dd>
            </>
          )}
          <dt>Failed logins</dt>
          <dd>{failedLoginCount}</dd>
          <dt>Password changed</dt>
          <dd>
            <DateTime iso={passwordChangedUtc} />
          </dd>
          <dt>Permissions</dt>
          <dd>
            {permissions.length ? permissions.join(', ') : <span className="muted">None</span>}
          </dd>
        </dl>
        {can(PERMISSIONS.auditRead) && (
          <p>
            <Link to={`/admin/audit?userId=${encodeURIComponent(user.id)}`}>
              View audit log for this user
            </Link>
          </p>
        )}
      </div>

      {can(PERMISSIONS.usersManage) && <UserAccountActions user={user} isSelf={isSelf} />}

      <UserRolesEditor
        userId={user.id}
        email={user.email}
        currentRoles={roles}
        isSelf={isSelf}
        canAssign={can(PERMISSIONS.rolesAssign)}
        canReadRoles={can(PERMISSIONS.rolesRead)}
      />

      {can(PERMISSIONS.sessionsRead) && (
        <UserSessionsPanel
          userId={user.id}
          email={user.email}
          canRevoke={can(PERMISSIONS.sessionsRevoke)}
        />
      )}
    </section>
  );
}
