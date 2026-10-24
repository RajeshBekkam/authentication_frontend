import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { describe, expect, it } from 'vitest';
import { getCsrfToken } from '../../api/csrf';
import { renderApp } from '../../test/renderApp';
import { makeMe, problem, server } from '../../test/server';

async function fillAndSubmit(email = 'user@example.com', password = 'wrong password!') {
  const user = userEvent.setup();
  await user.type(await screen.findByLabelText('Email'), email);
  await user.type(screen.getByLabelText('Password'), password);
  await user.click(screen.getByRole('button', { name: 'Sign in' }));
  return user;
}

describe('LoginPage', () => {
  it('always requests the cookie transport, stores the CSRF token in memory and redirects to returnTo', async () => {
    let body: unknown;
    const me = makeMe({ csrfToken: 'from-me' });
    server.use(
      http.post('/api/auth/login', async ({ request }) => {
        body = await request.json();
        // Once logged in, /me answers with the user.
        server.use(http.get('/api/auth/me', () => HttpResponse.json(me)));
        return HttpResponse.json({
          userId: me.userId,
          sessionId: me.sessionId,
          transport: 'cookie',
          token: null,
          csrfToken: 'from-login',
          idleExpiresUtc: new Date().toISOString(),
          absoluteExpiresUtc: me.absoluteExpiresUtc,
        });
      }),
    );
    const { router } = renderApp('/login?returnTo=%2Faccount', null);
    await fillAndSubmit('user@example.com', 'correct password');

    await waitFor(() => expect(router.state.location.pathname).toBe('/account'));
    expect(body).toEqual({
      email: 'user@example.com',
      password: 'correct password',
      transport: 'cookie',
    });
    expect(getCsrfToken()).toBe('from-me');
    // SR-1: nothing written to web storage (Node 25 may leave these undefined under jsdom).
    expect(window.localStorage?.length ?? 0).toBe(0);
    expect(window.sessionStorage?.length ?? 0).toBe(0);
  });

  it('ignores an external returnTo', async () => {
    const me = makeMe();
    server.use(
      http.post('/api/auth/login', () => {
        server.use(http.get('/api/auth/me', () => HttpResponse.json(me)));
        return HttpResponse.json({ csrfToken: 'x', transport: 'cookie', token: null });
      }),
    );
    const { router } = renderApp('/login?returnTo=https%3A%2F%2Fevil.example', null);
    await fillAndSubmit();
    await waitFor(() => expect(router.state.location.pathname).toBe('/'));
  });

  it('shows the generic message on 401 and clears the password', async () => {
    server.use(http.post('/api/auth/login', () => problem(401, 'Login failed')));
    renderApp('/login', null);
    await fillAndSubmit();
    expect(
      await screen.findByText('Invalid email or password, or the account is temporarily locked.'),
    ).toBeInTheDocument();
    expect(screen.getByLabelText('Password')).toHaveValue('');
    expect(screen.getByLabelText('Email')).toHaveValue('user@example.com');
  });

  it('shows the disabled message on 403', async () => {
    server.use(http.post('/api/auth/login', () => problem(403, 'Account disabled')));
    renderApp('/login', null);
    await fillAndSubmit();
    expect(
      await screen.findByText('This account has been disabled. Contact an administrator.'),
    ).toBeInTheDocument();
  });

  it('shows a countdown and disables submit on 429', async () => {
    server.use(
      http.post(
        '/api/auth/login',
        () => new HttpResponse(null, { status: 429, headers: { 'Retry-After': '30' } }),
      ),
    );
    renderApp('/login', null);
    await fillAndSubmit();
    expect(
      await screen.findByText(/Too many attempts\. Try again in (30|29) s\./),
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Sign in' })).toBeDisabled();
  });

  it('shows the session-ended banner', async () => {
    renderApp('/login?reason=expired', null);
    expect(
      await screen.findByText('Your session has ended. Please sign in again.'),
    ).toBeInTheDocument();
  });

  it('sends signed-in users away from /login', async () => {
    const { router } = renderApp('/login', makeMe());
    await waitFor(() => expect(router.state.location.pathname).toBe('/'));
  });
});

describe('RegisterPage', () => {
  async function register(password = 'a fine passphrase') {
    const user = userEvent.setup();
    await user.type(await screen.findByLabelText('Email'), 'new@example.com');
    await user.type(screen.getByLabelText('Password'), password);
    await user.type(screen.getByLabelText('Confirm password'), password);
    await user.click(screen.getByRole('button', { name: 'Create account' }));
  }

  it('goes to /login?registered=1 on 201', async () => {
    server.use(
      http.post('/api/auth/register', () =>
        HttpResponse.json({ id: 'x', email: 'new@example.com' }, { status: 201 }),
      ),
    );
    const { router } = renderApp('/register', null);
    await register();
    await waitFor(() => expect(router.state.location.search).toBe('?registered=1'));
    expect(await screen.findByText('Account created. You can sign in now.')).toBeInTheDocument();
  });

  it('shows the 409 message', async () => {
    server.use(http.post('/api/auth/register', () => problem(409, 'Email already registered')));
    renderApp('/register', null);
    await register();
    expect(
      await screen.findByText('An account with this email already exists.'),
    ).toBeInTheDocument();
  });

  it('maps 400 errors.Password onto the password field', async () => {
    server.use(
      http.post('/api/auth/register', () =>
        problem(400, 'One or more validation errors occurred.', {
          errors: { Password: ['Server says no.'] },
        }),
      ),
    );
    renderApp('/register', null);
    await register();
    expect(await screen.findByText('Server says no.')).toBeInTheDocument();
    expect(screen.getByLabelText('Password')).toHaveAttribute('aria-invalid', 'true');
  });

  it('blocks submission when client rules fail', async () => {
    let called = false;
    server.use(
      http.post('/api/auth/register', () => {
        called = true;
        return HttpResponse.json({}, { status: 201 });
      }),
    );
    renderApp('/register', null);
    await register('short');
    expect(await screen.findByText('Password must be at least 12 characters.')).toBeInTheDocument();
    expect(called).toBe(false);
  });
});
