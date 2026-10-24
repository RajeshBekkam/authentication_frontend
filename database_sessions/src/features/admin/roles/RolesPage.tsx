import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { listPermissions, listRoles, setRolePermissions } from '../../../api/endpoints/admin';
import { queryKeys } from '../../../api/queryKeys';
import {
  ADMIN_ROLE,
  PERMISSIONS,
  type PermissionResponse,
  type RoleResponse,
} from '../../../api/types';
import { useHasPermission } from '../../../auth/useMe';
import { ConfirmDialog } from '../../../components/ConfirmDialog';
import { EmptyState, TableSkeleton } from '../../../components/Loaders';
import { ProblemAlert, QueryError } from '../../../components/ProblemAlert';
import { Tooltip } from '../../../components/Tooltip';
import { showToast } from '../../../lib/toast';
import { CreateRoleForm } from './CreateRoleForm';

const isAdminRole = (name: string) => name.toLowerCase() === ADMIN_ROLE.toLowerCase();

export default function RolesPage() {
  const canManage = useHasPermission(PERMISSIONS.rolesManage);
  const roles = useQuery({ queryKey: queryKeys.roles, queryFn: ({ signal }) => listRoles(signal) });
  const permissions = useQuery({
    queryKey: queryKeys.permissions,
    queryFn: ({ signal }) => listPermissions(signal),
  });

  const error = roles.error ?? permissions.error;
  const roleList = roles.data;
  const permissionList = permissions.data;

  return (
    <section className="page">
      <h1>Roles &amp; permissions</h1>
      {canManage && <CreateRoleForm />}
      <div className="card">
        <h2>Permission matrix</h2>
        {error ? (
          <QueryError
            error={error}
            onRetry={() => {
              void roles.refetch();
              void permissions.refetch();
            }}
          />
        ) : !roleList || !permissionList ? (
          <TableSkeleton columns={6} />
        ) : roleList.length === 0 ? (
          <EmptyState>No roles defined.</EmptyState>
        ) : (
          <div className="table-wrap">
            <table className="table matrix">
              <caption className="visually-hidden">Permissions granted to each role</caption>
              <thead>
                <tr>
                  <th scope="col">Role</th>
                  {permissionList.map((p) => (
                    <th scope="col" key={p.id}>
                      <Tooltip text={p.description || p.name}>{p.name}</Tooltip>
                    </th>
                  ))}
                  {canManage && (
                    <th scope="col">
                      <span className="visually-hidden">Actions</span>
                    </th>
                  )}
                </tr>
              </thead>
              <tbody>
                {roleList.map((role) => (
                  <RoleRow
                    key={role.name}
                    role={role}
                    permissions={permissionList}
                    canManage={canManage}
                  />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </section>
  );
}

function RoleRow({
  role,
  permissions,
  canManage,
}: {
  role: RoleResponse;
  permissions: PermissionResponse[];
  canManage: boolean;
}) {
  const queryClient = useQueryClient();
  const [draft, setDraft] = useState<string[] | null>(null);
  const [confirming, setConfirming] = useState(false);
  const locked = isAdminRole(role.name);
  const editable = canManage && !locked;
  const current = draft ?? role.permissions;
  const has = (list: string[], p: string) => list.some((x) => x.toLowerCase() === p.toLowerCase());
  const removed = role.permissions.filter((p) => !has(current, p));
  const dirty =
    draft !== null &&
    (draft.length !== role.permissions.length || draft.some((p) => !has(role.permissions, p)));

  const save = useMutation({
    mutationFn: (next: string[]) => setRolePermissions(role.name, next),
    onSuccess: () => {
      setConfirming(false);
      setDraft(null);
      showToast(`Permissions for ${role.name} saved.`, 'success');
      void queryClient.invalidateQueries({ queryKey: queryKeys.roles });
      // The editor may hold this role; their own navigation could change.
      void queryClient.invalidateQueries({ queryKey: queryKeys.me });
    },
  });

  function toggle(p: string, checked: boolean) {
    save.reset();
    setDraft((prev) => {
      const base = prev ?? role.permissions;
      return checked ? [...base, p] : base.filter((x) => x.toLowerCase() !== p.toLowerCase());
    });
  }

  return (
    <tr>
      <th scope="row">
        <span className="role-name">
          {role.name}
          {role.isSystem && <span className="badge badge-info">System</span>}
          {locked && (
            <Tooltip text="The Admin role always has every permission.">
              <span aria-label="Locked" role="img">
                🔒
              </span>
            </Tooltip>
          )}
        </span>
        {role.description && <div className="muted small">{role.description}</div>}
      </th>
      {permissions.map((p) => {
        const checked = locked || has(current, p.name);
        return (
          <td key={p.id} className="cell-center">
            <input
              type="checkbox"
              checked={checked}
              disabled={!editable || save.isPending}
              aria-label={`${p.name} for ${role.name}`}
              onChange={(e) => toggle(p.name, e.target.checked)}
            />
          </td>
        );
      })}
      {canManage && (
        <td className="cell-actions">
          {dirty && (
            <div className="toolbar">
              <button
                type="button"
                className="btn btn-small btn-primary"
                disabled={save.isPending}
                onClick={() => (removed.length ? setConfirming(true) : save.mutate(current))}
              >
                Save
              </button>
              <button type="button" className="btn btn-small" onClick={() => setDraft(null)}>
                Cancel
              </button>
            </div>
          )}
          {!confirming && <ProblemAlert error={save.error} />}
          <ConfirmDialog
            open={confirming}
            title="Remove permissions?"
            confirmLabel="Save"
            destructive
            pending={save.isPending}
            error={save.error}
            onCancel={() => {
              setConfirming(false);
              save.reset();
            }}
            onConfirm={() => save.mutate(current)}
          >
            <p>
              Remove <strong>{removed.join(', ')}</strong> from the <strong>{role.name}</strong>{' '}
              role? Every user with this role loses them on their next request.
            </p>
          </ConfirmDialog>
        </td>
      )}
    </tr>
  );
}
