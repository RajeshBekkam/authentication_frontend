# database_sessions — React frontend

Browser client for the `database_sessions` ASP.NET Core auth backend, built to
[PRD_React_Frontend.md](PRD_React_Frontend.md). The backend is the source of truth; the UI only
reflects what the API says.

## Run it

```powershell
# 1. Start the backend on http://localhost:5154 (Development profile).
# 2. Then:
npm install
npm run dev        # http://localhost:5173, /api is proxied to :5154 (same origin)
```

Use Chrome or Firefox locally: they accept the `Secure` `__Host-sid` cookie on `http://localhost`.

| Script                                  | What it does                                                 |
| --------------------------------------- | ------------------------------------------------------------ |
| `npm run build`                         | Type-check + production build to `dist/` (no source maps)    |
| `npm test`                              | Vitest + React Testing Library + MSW                         |
| `npm run e2e`                           | Playwright acceptance suite against the real backend (below) |
| `npm run lint` / `typecheck` / `format` | Quality gates                                                |
| `npm run gen:api`                       | Regenerate `src/api/schema.d.ts` from the backend's OpenAPI  |

## How auth works here

- **Cookie transport only.** Login always sends `transport: "cookie"`. The session token lives in
  the HttpOnly cookie and is never visible to JS.
- **CSRF token in memory only** (`src/api/csrf.ts`). After a reload it is re-read from
  `GET /api/auth/me`. Nothing auth-related touches `localStorage`/`sessionStorage`; ESLint enforces it.
- **`['me']` is the auth state** (TanStack Query, `src/auth/session.ts`). It is refetched on window
  focus so permission changes show up promptly.
- **`apiFetch`** (`src/api/apiFetch.ts`) is the only HTTP client. It attaches `X-CSRF-Token` on
  POST/PUT/DELETE and handles errors globally: 401 → login with "session ended"; CSRF 403 → refetch
  `/me` and retry once; other 403 → toast + refetch `/me`; 429 → `Retry-After` countdown; 5xx → toast.
- **Multi-tab:** `BroadcastChannel('auth')` syncs logout, login and activity across tabs.
- **Session UX:** an inactivity warning after 25 minutes without a successful API call, and a banner
  10 minutes before the absolute expiry. The server enforces both limits.
- **Route guards:** `RequireAuth`, `RequireAnonymous`, `RequirePermission` (403 page, not a login
  redirect). Admin pages are lazy-loaded chunks.

## End-to-end tests (PRD §10.1)

```powershell
$env:E2E_ADMIN_EMAIL = '<bootstrap admin email>'
$env:E2E_ADMIN_PASSWORD = '<bootstrap admin password>'
npx playwright install chromium
npm run e2e
```

The backend must be running. Admin-dependent specs are skipped when the env vars are missing. The
backend's auth rate limit is 10/min per IP by default; starting it with
`Auth__RateLimit__PermitLimit=100` keeps setup logins from being throttled. AC 11 keeps failing
logins until it sees a 429, so it works with any limit. AC 7 uses a dev-only hook
(`window.__authTest.dropNextCsrfHeader()`) that is absent from production builds.

## Production

Serve `dist/` and `/api/*` from **one HTTPS origin**. See [deploy/nginx.conf](deploy/nginx.conf):
the SPA fallback, the CSP `default-src 'self'; frame-ancestors 'none'; object-src 'none'` (SR-5),
and a 404 for `*.map` (SR-4). Don't configure the backend's `Cors:AllowedOrigins` for this setup.

## UI components

The app uses a small in-house component set (`src/components`) instead of a third-party library.
That keeps the initial bundle around 118 KB gzipped (budget: 200 KB). Dialogs use native modal
`<dialog>` elements, which provide focus trapping and Escape handling. Light and dark mode follow
`prefers-color-scheme`.
