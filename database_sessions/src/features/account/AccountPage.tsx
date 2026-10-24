import { useCurrentUser } from '../../auth/useMe';
import { ChangePasswordForm } from './ChangePasswordForm';

export function AccountPage() {
  const me = useCurrentUser();
  return (
    <section className="page">
      <h1>Account</h1>
      <div className="card">
        <dl className="details">
          <dt>Email</dt>
          <dd>{me.email}</dd>
          <dt>Roles</dt>
          <dd>{me.roles.length ? me.roles.join(', ') : <span className="muted">None</span>}</dd>
        </dl>
        <details className="collapsible">
          <summary>Permissions ({me.permissions.length})</summary>
          {me.permissions.length ? (
            <ul className="chip-list">
              {me.permissions.map((p) => (
                <li key={p} className="chip">
                  {p}
                </li>
              ))}
            </ul>
          ) : (
            <p className="muted">No permissions.</p>
          )}
        </details>
      </div>
      <div className="card">
        <h2>Change password</h2>
        <ChangePasswordForm email={me.email} />
      </div>
    </section>
  );
}
