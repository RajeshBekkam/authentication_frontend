import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterAll, afterEach, beforeAll } from 'vitest';
import { clearCsrfToken } from '../api/csrf';
import { clearToasts } from '../lib/toast';
import { server } from './server';

// jsdom has no <dialog> modal support yet.
if (!HTMLDialogElement.prototype.showModal) {
  HTMLDialogElement.prototype.showModal = function showModal(this: HTMLDialogElement) {
    this.setAttribute('open', '');
  };
  HTMLDialogElement.prototype.close = function close(this: HTMLDialogElement) {
    this.removeAttribute('open');
  };
}

// Node's undici rejects jsdom's AbortSignal ("Expected signal to be an instance of AbortSignal").
// Tests never abort, so drop the signal at the Node boundary.
function withoutSignal(init?: RequestInit): RequestInit | undefined {
  if (!init?.signal) return init;
  const rest = { ...init };
  delete rest.signal;
  return rest;
}
const NodeRequest = globalThis.Request;
globalThis.Request = class extends NodeRequest {
  constructor(input: RequestInfo | URL, init?: RequestInit) {
    super(input, withoutSignal(init));
  }
} as typeof Request;

beforeAll(() => {
  server.listen({ onUnhandledRequest: 'error' });
  // Node's fetch can't resolve relative URLs; the app always uses them (same-origin), so resolve
  // against jsdom's location. Installed after MSW so MSW sees absolute URLs.
  const mswFetch = globalThis.fetch;
  globalThis.fetch = (input: RequestInfo | URL, init?: RequestInit) =>
    mswFetch(
      typeof input === 'string' ? new URL(input, window.location.origin) : input,
      withoutSignal(init),
    );
});

afterEach(() => {
  cleanup();
  server.resetHandlers();
  clearCsrfToken();
  clearToasts();
});

afterAll(() => server.close());
