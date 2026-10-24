import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { listRoles, setUserRoles } from '../../../api/endpoints/admin';
import { queryKeys } from '../../../api/queryKeys';
import { ConfirmDialog } from '../../../components/ConfirmDialog';
import { ProblemAlert, QueryError } from '../../../components/ProblemAlert';
import { showToast } from '../../../lib/toast';

type Props = {
  userId: string;
  email: string;
  currentRoles: string[];
  isSelf: boolean;
  canAssign: boolean;
  canReadRoles: boolean;
};

const sameSet = (a: string[], b: string[]) =>
  a.length === b.length && a.every((x) => b.some((y) => y.toLowerCase() === x.toLowerCase()));

export function UserRolesEditor({
  userId,
  email,
  currentRoles,
  isSelf,
  canAssign,
  canReadRoles,
}: Props) {
  // Editing needs roles.assign, the full role list (roles.read), and a record that isn't your own.
  const editable = canAssign && canReadRoles && !isSelf;

  return (
    <div className="card">
      <h2>Roles</h2>
      {editable ? (
        <RolesForm userId={userId} email={email} currentRoles={currentRoles} />
      ) : (
        <>
          <p>
            {currentRoles.length ? (
              currentRoles.join(', ')
            ) : (
              <span className="muted">No roles</span>
            )}
          </p>
          {canAssign && isSelf && <p className="muted">You cannot change your own roles.</p>}
        </>
      )}
    </div>
  );
}

function RolesForm({
  userId,
  email,
  currentRoles,
}: {
  userId: string;
  email: string;
  currentRoles: string[];
}) {
  const queryClient = useQueryClient();
  const roles = useQuery({ queryKey: queryKeys.roles, queryFn: ({ signal }) => listRoles(signal) });
  const [selected, setSelected] = useState<string[]>(currentRoles);
  const [confirming, setConfirming] = useState(false);

  useEffect(() => setSelected(currentRoles), [currentRoles]);

  const save = useMutation({
    mutationFn: (next: string[]) => setUserRoles(userId, next),
    onSuccess: () => {
      setConfirming(false);
      showToast('Roles updated.', 'success');
      void queryClient.invalidateQueries({ queryKey: queryKeys.user(userId) });
    },
  });

  const removed = currentRoles.filter(
    (r) => !selected.some((s) => s.toLowerCase() === r.toLowerCase()),
  );
  const dirty = !sameSet(selected, currentRoles);

  function toggle(name: string, checked: boolean) {
    save.reset();
    setSelected((prev) => (checked ? [...prev, name] : prev.filter((r) => r !== name)));
  }

  function submit() {
    // Removing a role is a demotion: confirm it, naming the user and the roles.
    if (removed.length > 0) setConfirming(true);
    else save.mutate(selected);
  }

  if (roles.isError) return <QueryError error={roles.error} onRetry={() => void roles.refetch()} />;
  if (roles.isPending) return <p className="muted">Loading roles…</p>;

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        submit();
      }}
    >
      <fieldset className="checkbox-group">
        <legend className="visually-hidden">Roles for {email}</legend>
        {roles.data.map((r) => (
          <label key={r.name} className="checkbox">
            <input
              type="checkbox"
              checked={selected.some((s) => s.toLowerCase() === r.name.toLowerCase())}
              onChange={(e) => toggle(r.name, e.target.checked)}
            />
            <span>{r.name}</span>
            {r.description && <span className="muted"> — {r.description}</span>}
          </label>
        ))}
      </fieldset>
      <p className="muted">
        Changes take effect on the user&apos;s next request. No re-login needed.
      </p>
      {!confirming && <ProblemAlert error={save.error} />}
      <div className="toolbar">
        <button type="submit" className="btn btn-primary" disabled={!dirty || save.isPending}>
          {save.isPending ? 'Saving…' : 'Save roles'}
        </button>
        {dirty && (
          <button type="button" className="btn" onClick={() => setSelected(currentRoles)}>
            Reset
          </button>
        )}
      </div>

      <ConfirmDialog
        open={confirming}
        title="Remove roles?"
        confirmLabel="Save roles"
        destructive
        pending={save.isPending}
        error={save.error}
        onCancel={() => {
          setConfirming(false);
          save.reset();
        }}
        onConfirm={() => save.mutate(selected)}
      >
        <p>
          Remove <strong>{removed.join(', ')}</strong> from <strong>{email}</strong>? They lose the
          matching permissions on their next request.
        </p>
      </ConfirmDialog>
    </form>
  );
}
