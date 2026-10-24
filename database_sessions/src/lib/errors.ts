import { ApiError, NetworkError } from '../api/apiFetch';

export function describeError(error: unknown): string {
  if (error instanceof ApiError) {
    if (error.status === 429) return `Too many attempts. Try again in ${error.retryAfter ?? 60} s.`;
    if (error.status >= 500) return 'Something went wrong on the server. Please try again.';
    if (error.status === 403) return "You don't have permission to do that.";
    return error.problem.detail || error.problem.title || `Request failed (${error.status}).`;
  }
  if (error instanceof NetworkError)
    return "Can't reach the server. Check your connection and try again.";
  return 'Something went wrong. Please try again.';
}

/** Audit `details` is a JSON string. Parse defensively; the result is only ever rendered as text (SR-2). */
export function formatDetails(details: string | null): string | null {
  if (details === null || details === '') return null;
  try {
    return JSON.stringify(JSON.parse(details), null, 2);
  } catch {
    return details;
  }
}
