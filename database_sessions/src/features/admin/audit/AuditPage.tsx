import { useInfiniteQuery } from '@tanstack/react-query';
import { Fragment, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { AUDIT_PAGE_SIZE, listAudit } from '../../../api/endpoints/admin';
import { queryKeys } from '../../../api/queryKeys';
import { AUDIT_EVENT_TYPES, PERMISSIONS, type AuditRecord } from '../../../api/types';
import { useHasPermission } from '../../../auth/useMe';
import { EmptyState, TableSkeleton } from '../../../components/Loaders';
import { QueryError } from '../../../components/ProblemAlert';
import { DateTime, Tooltip } from '../../../components/Tooltip';
import { formatDetails } from '../../../lib/errors';
import { isGuid, shortId } from '../../../lib/format';
import { describeUserAgent } from '../../../lib/userAgent';

export default function AuditPage() {
  const [params, setParams] = useSearchParams();
  const eventType = params.get('eventType') ?? '';
  const userId = params.get('userId') ?? '';
  const [userIdInput, setUserIdInput] = useState(userId);
  const userIdValid = userId === '' || isGuid(userId);

  const audit = useInfiniteQuery({
    queryKey: queryKeys.audit(userId, eventType),
    queryFn: ({ pageParam, signal }) =>
      listAudit(
        { userId: userId || undefined, eventType: eventType || undefined, page: pageParam },
        signal,
      ),
    initialPageParam: 1,
    // No total from the API: a short page means there is nothing more.
    getNextPageParam: (last, pages) =>
      last.length < AUDIT_PAGE_SIZE ? undefined : pages.length + 1,
    enabled: userIdValid,
  });

  function setFilter(key: 'eventType' | 'userId', value: string) {
    const next = new URLSearchParams(params);
    if (value) next.set(key, value);
    else next.delete(key);
    setParams(next, { replace: true });
  }

  const rows = audit.data?.pages.flat() ?? [];

  return (
    <section className="page">
      <h1>Audit log</h1>
      <form
        className="toolbar filters"
        onSubmit={(e) => {
          e.preventDefault();
          setFilter('userId', userIdInput.trim());
        }}
      >
        <div className="field field-inline">
          <label htmlFor="audit-event">Event type</label>
          <select
            id="audit-event"
            value={eventType}
            onChange={(e) => setFilter('eventType', e.target.value)}
          >
            <option value="">All events</option>
            {AUDIT_EVENT_TYPES.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </div>
        <div className="field field-inline">
          <label htmlFor="audit-user">User id</label>
          <input
            id="audit-user"
            value={userIdInput}
            onChange={(e) => setUserIdInput(e.target.value)}
            placeholder="00000000-0000-0000-0000-000000000000"
            aria-invalid={!userIdValid || undefined}
            aria-describedby={!userIdValid ? 'audit-user-error' : undefined}
          />
        </div>
        <button type="submit" className="btn">
          Apply
        </button>
        {(userId || eventType) && (
          <button
            type="button"
            className="btn btn-ghost"
            onClick={() => {
              setUserIdInput('');
              setParams(new URLSearchParams(), { replace: true });
            }}
          >
            Clear filters
          </button>
        )}
      </form>
      {!userIdValid && (
        <p id="audit-user-error" className="field-error" role="alert">
          Enter a valid user id (GUID).
        </p>
      )}

      {audit.isError ? (
        <QueryError error={audit.error} onRetry={() => void audit.refetch()} />
      ) : audit.isPending && userIdValid ? (
        <TableSkeleton columns={8} rows={10} />
      ) : rows.length === 0 ? (
        <EmptyState>No audit events match these filters.</EmptyState>
      ) : (
        <>
          <AuditTable rows={rows} />
          <div className="load-more">
            {audit.hasNextPage ? (
              <button
                type="button"
                className="btn"
                disabled={audit.isFetchingNextPage}
                onClick={() => void audit.fetchNextPage()}
              >
                {audit.isFetchingNextPage ? 'Loading…' : 'Load more'}
              </button>
            ) : (
              <p className="muted">End of log · {rows.length} events</p>
            )}
          </div>
        </>
      )}
    </section>
  );
}

function AuditTable({ rows }: { rows: AuditRecord[] }) {
  const [expanded, setExpanded] = useState<Set<number>>(new Set());
  const canReadUsers = useHasPermission(PERMISSIONS.usersRead);

  function toggle(id: number) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  const userLink = (id: string | null) => {
    if (!id) return <span className="muted">—</span>;
    const label = <Tooltip text={id}>{shortId(id)}</Tooltip>;
    return canReadUsers ? <Link to={`/admin/users/${id}`}>{shortId(id)}</Link> : label;
  };

  return (
    <div className="table-wrap">
      <table className="table audit">
        <caption className="visually-hidden">Audit events</caption>
        <thead>
          <tr>
            <th scope="col">Time</th>
            <th scope="col">Event</th>
            <th scope="col">Subject user</th>
            <th scope="col">Actor user</th>
            <th scope="col">Session</th>
            <th scope="col">IP</th>
            <th scope="col">User agent</th>
            <th scope="col">Details</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => {
            const details = formatDetails(r.details);
            const open = expanded.has(r.id);
            return (
              <Fragment key={r.id}>
                <tr>
                  <td>
                    <DateTime iso={r.occurredUtc} />
                  </td>
                  <td>
                    <code>{r.eventType}</code>
                  </td>
                  <td>{userLink(r.userId)}</td>
                  <td>{userLink(r.actorUserId)}</td>
                  <td>
                    {r.sessionId ? (
                      <Tooltip text={r.sessionId}>{shortId(r.sessionId)}</Tooltip>
                    ) : (
                      <span className="muted">—</span>
                    )}
                  </td>
                  <td>{r.ipAddress ?? <span className="muted">—</span>}</td>
                  <td>
                    {r.userAgent ? (
                      <Tooltip text={r.userAgent}>{describeUserAgent(r.userAgent)}</Tooltip>
                    ) : (
                      <span className="muted">—</span>
                    )}
                  </td>
                  <td>
                    {details ? (
                      <button
                        type="button"
                        className="btn btn-small"
                        aria-expanded={open}
                        aria-controls={`audit-details-${r.id}`}
                        onClick={() => toggle(r.id)}
                      >
                        {open ? 'Hide' : 'Show'}
                      </button>
                    ) : (
                      <span className="muted">—</span>
                    )}
                  </td>
                </tr>
                {details && open && (
                  <tr id={`audit-details-${r.id}`} className="details-row">
                    <td colSpan={8}>
                      <pre>{details}</pre>
                    </td>
                  </tr>
                )}
              </Fragment>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
