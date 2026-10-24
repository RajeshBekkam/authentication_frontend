import { describeError } from '../lib/errors';

type Props = {
  /** Either an error to describe or an explicit message. */
  error?: unknown;
  message?: string | null;
  kind?: 'error' | 'success' | 'info' | 'warning';
};

/** Inline message announced to assistive tech. Text only: never renders API data as HTML (SR-2). */
export function ProblemAlert({ error, message, kind = 'error' }: Props) {
  const text = message ?? (error !== undefined && error !== null ? describeError(error) : null);
  if (!text) return null;
  return (
    <div className={`alert alert-${kind}`} role={kind === 'error' ? 'alert' : 'status'}>
      {text}
    </div>
  );
}

export function QueryError({ error, onRetry }: { error: unknown; onRetry?: () => void }) {
  return (
    <div className="query-error">
      <ProblemAlert error={error} />
      {onRetry && (
        <button type="button" className="btn" onClick={onRetry}>
          Retry
        </button>
      )}
    </div>
  );
}
