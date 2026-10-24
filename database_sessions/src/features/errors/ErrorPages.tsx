import { Link } from 'react-router-dom';

export function ForbiddenPage() {
  return (
    <section className="page">
      <h1>403 — Not allowed</h1>
      <p>You don&apos;t have permission to view this page.</p>
      <Link to="/">Go to Home</Link>
    </section>
  );
}

export function NotFoundPage() {
  return (
    <main className="center-page">
      <div className="page">
        <h1>404 — Page not found</h1>
        <p>There is nothing at this address.</p>
        <Link to="/">Go to Home</Link>
      </div>
    </main>
  );
}

export function ResourceNotFound({
  what,
  backTo,
  backLabel,
}: {
  what: string;
  backTo: string;
  backLabel: string;
}) {
  return (
    <section className="page">
      <h1>{what} not found</h1>
      <p>It may have been removed, or the link is wrong.</p>
      <Link to={backTo}>{backLabel}</Link>
    </section>
  );
}
