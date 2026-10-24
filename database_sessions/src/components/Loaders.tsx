export function FullPageLoader() {
  return (
    <main className="center-page" aria-busy="true">
      <div className="spinner" role="status">
        <span className="visually-hidden">Loading…</span>
      </div>
    </main>
  );
}

export function TableSkeleton({ rows = 5, columns = 4 }: { rows?: number; columns?: number }) {
  return (
    <div className="table-skeleton" role="status" aria-label="Loading">
      {Array.from({ length: rows }, (_, r) => (
        <div className="skeleton-row" key={r}>
          {Array.from({ length: columns }, (_, c) => (
            <span className="skeleton" key={c} />
          ))}
        </div>
      ))}
    </div>
  );
}

export function EmptyState({ children }: { children: React.ReactNode }) {
  return <p className="empty-state">{children}</p>;
}
