import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { describe, expect, it } from 'vitest';
import type { AuditRecord } from '../../../api/types';
import { formatDetails } from '../../../lib/errors';
import { renderApp } from '../../../test/renderApp';
import { adminMe, server } from '../../../test/server';

function record(id: number, details: string | null = null): AuditRecord {
  return {
    id,
    occurredUtc: '2026-10-01T10:00:00Z',
    eventType: 'login.failed',
    userId: null,
    actorUserId: null,
    sessionId: null,
    ipAddress: '127.0.0.1',
    userAgent: null,
    details,
  };
}

describe('formatDetails', () => {
  it('pretty-prints JSON, passes through invalid JSON, and handles null', () => {
    expect(formatDetails('{"a":1}')).toBe('{\n  "a": 1\n}');
    expect(formatDetails('not json')).toBe('not json');
    expect(formatDetails(null)).toBeNull();
  });
});

describe('AuditPage', () => {
  it('renders details as text, never HTML', async () => {
    const xss = JSON.stringify({ note: '<img src=x onerror=alert(1)>' });
    server.use(http.get('/api/admin/audit', () => HttpResponse.json([record(1, xss)])));
    const { container } = renderApp('/admin/audit', adminMe());
    const user = userEvent.setup();
    await user.click(await screen.findByRole('button', { name: 'Show' }));
    expect(screen.getByText(/<img src=x onerror=alert\(1\)>/)).toBeInTheDocument();
    expect(container.querySelector('img')).toBeNull();
  });

  it('loads more until a short page arrives', async () => {
    const pages: number[] = [];
    server.use(
      http.get('/api/admin/audit', ({ request }) => {
        const page = Number(new URL(request.url).searchParams.get('page'));
        pages.push(page);
        const count = page === 1 ? 50 : 3;
        return HttpResponse.json(Array.from({ length: count }, (_, i) => record(page * 100 + i)));
      }),
    );
    renderApp('/admin/audit', adminMe());
    const user = userEvent.setup();
    await user.click(await screen.findByRole('button', { name: 'Load more' }));
    expect(await screen.findByText('End of log · 53 events')).toBeInTheDocument();
    expect(pages).toEqual([1, 2]);
  });

  it('passes the user id filter from the URL', async () => {
    let userId: string | null = null;
    server.use(
      http.get('/api/admin/audit', ({ request }) => {
        userId = new URL(request.url).searchParams.get('userId');
        return HttpResponse.json([]);
      }),
    );
    const id = '44444444-4444-4444-4444-444444444444';
    renderApp(`/admin/audit?userId=${id}`, adminMe());
    await waitFor(() => expect(userId).toBe(id));
    expect(await screen.findByText('No audit events match these filters.')).toBeInTheDocument();
  });
});
