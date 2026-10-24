import { useCurrentUser } from '../../auth/useMe';
import { DateTime } from '../../components/Tooltip';

export function HomePage() {
  const me = useCurrentUser();
  return (
    <section className="page">
      <h1>Welcome</h1>
      <div className="card">
        <dl className="details">
          <dt>Signed in as</dt>
          <dd>{me.email}</dd>
          <dt>Roles</dt>
          <dd>{me.roles.length ? me.roles.join(', ') : <span className="muted">None</span>}</dd>
          <dt>Session ends at</dt>
          <dd>
            <DateTime iso={me.absoluteExpiresUtc} />
          </dd>
        </dl>
      </div>
    </section>
  );
}
