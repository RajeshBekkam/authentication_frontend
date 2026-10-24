import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { listUsers } from '../../../api/endpoints/admin';
import { queryKeys } from '../../../api/queryKeys';
import { EmptyState, TableSkeleton } from '../../../components/Loaders';
import { QueryError } from '../../../components/ProblemAlert';
import { UserStatusBadge } from '../../../components/StatusBadge';
import { DateTime } from '../../../components/Tooltip';
import { useDebouncedValue } from '../../../lib/hooks';

export const USERS_PAGE_SIZE = 25;

export default function UsersListPage() {
  const [params, setParams] = useSearchParams();
  const page = Math.max(1, Number(params.get('page')) || 1);
  const [search, setSearch] = useState(params.get('search') ?? '');
  const debouncedSearch = useDebouncedValue(search.trim(), 300);

  // Keep the URL in sync with the debounced search; a new search starts at page 1.
  useEffect(() => {
    const current = params.get('search') ?? '';
    if (current === debouncedSearch) return;
    const next = new URLSearchParams(params);
    if (debouncedSearch) next.set('search', debouncedSearch);
    else next.delete('search');
    next.delete('page');
    setParams(next, { replace: true });
  }, [debouncedSearch, params, setParams]);

  const users = useQuery({
    queryKey: queryKeys.users(debouncedSearch, page),
    queryFn: ({ signal }) =>
      listUsers({ search: debouncedSearch, page, pageSize: USERS_PAGE_SIZE }, signal),
    placeholderData: keepPreviousData,
  });

  const totalPages = users.data
    ? Math.max(1, Math.ceil(users.data.total / users.data.pageSize))
    : 1;

  function goTo(p: number) {
    const next = new URLSearchParams(params);
    if (p > 1) next.set('page', String(p));
    else next.delete('page');
    setParams(next);
  }

  return (
    <section className="page">
      <h1>Users</h1>
      <div className="toolbar">
        <div className="field field-inline">
          <label htmlFor="user-search">Search by email</label>
          <input
            id="user-search"
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="name@example.com"
          />
        </div>
      </div>

      {users.isError ? (
        <QueryError error={users.error} onRetry={() => void users.refetch()} />
      ) : users.isPending ? (
        <TableSkeleton columns={3} rows={8} />
      ) : users.data.items.length === 0 ? (
        <EmptyState>{debouncedSearch ? 'No users match that search.' : 'No users yet.'}</EmptyState>
      ) : (
        <>
          <div className="table-wrap" aria-busy={users.isFetching}>
            <table className="table">
              <caption className="visually-hidden">Users</caption>
              <thead>
                <tr>
                  <th scope="col">Email</th>
                  <th scope="col">Status</th>
                  <th scope="col">Created</th>
                </tr>
              </thead>
              <tbody>
                {users.data.items.map((u) => (
                  <tr key={u.id}>
                    <td>
                      <Link to={`/admin/users/${u.id}`}>{u.email}</Link>
                    </td>
                    <td>
                      <UserStatusBadge user={u} />
                    </td>
                    <td>
                      <DateTime iso={u.createdUtc} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <nav className="pagination" aria-label="Pagination">
            <button
              type="button"
              className="btn"
              disabled={page <= 1}
              onClick={() => goTo(page - 1)}
            >
              Previous
            </button>
            <span aria-live="polite">
              Page {page} of {totalPages} · {users.data.total} users
            </span>
            <button
              type="button"
              className="btn"
              disabled={page >= totalPages}
              onClick={() => goTo(page + 1)}
            >
              Next
            </button>
          </nav>
        </>
      )}
    </section>
  );
}
