import { zodResolver } from '@hookform/resolvers/zod';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { Link, useSearchParams } from 'react-router-dom';
import { ApiError } from '../../api/apiFetch';
import { login } from '../../api/endpoints/auth';
import { completeLogin } from '../../auth/session';
import { FormField } from '../../components/FormField';
import { ProblemAlert } from '../../components/ProblemAlert';
import { describeError } from '../../lib/errors';
import { useRetryCountdown } from '../../lib/hooks';
import { loginSchema, type LoginValues } from './validation';

export const LOGIN_FAILED_MESSAGE =
  'Invalid email or password, or the account is temporarily locked.';
export const ACCOUNT_DISABLED_MESSAGE = 'This account has been disabled. Contact an administrator.';
export const SESSION_ENDED_MESSAGE = 'Your session has ended. Please sign in again.';

export function LoginPage() {
  const [params] = useSearchParams();
  const [error, setError] = useState<string | null>(null);
  const countdown = useRetryCountdown();
  const {
    register,
    handleSubmit,
    setValue,
    setFocus,
    formState: { errors, isSubmitting },
  } = useForm<LoginValues>({ resolver: zodResolver(loginSchema) });

  async function onSubmit(values: LoginValues) {
    setError(null);
    try {
      const res = await login(values.email, values.password);
      // <RequireAnonymous> redirects to the sanitized returnTo once ['me'] is populated.
      await completeLogin(res.csrfToken);
    } catch (err) {
      setValue('password', '');
      setFocus('password');
      if (err instanceof ApiError && err.status === 401) setError(LOGIN_FAILED_MESSAGE);
      else if (err instanceof ApiError && err.status === 403) setError(ACCOUNT_DISABLED_MESSAGE);
      else if (err instanceof ApiError && err.status === 429) {
        countdown.start(err.retryAfter ?? 60);
        setError(null);
      } else setError(describeError(err));
    }
  }

  const banner =
    params.get('registered') === '1'
      ? { kind: 'success' as const, text: 'Account created. You can sign in now.' }
      : params.get('reason') === 'expired'
        ? { kind: 'info' as const, text: SESSION_ENDED_MESSAGE }
        : null;

  return (
    <main className="auth-page">
      <div className="card auth-card">
        <h1>Sign in</h1>
        {banner && <ProblemAlert kind={banner.kind} message={banner.text} />}
        <ProblemAlert message={error} />
        {countdown.remaining > 0 && (
          <ProblemAlert message={`Too many attempts. Try again in ${countdown.remaining} s.`} />
        )}
        <form onSubmit={handleSubmit(onSubmit)} noValidate>
          <FormField
            label="Email"
            type="email"
            autoComplete="username"
            error={errors.email?.message}
            {...register('email')}
          />
          <FormField
            label="Password"
            type="password"
            autoComplete="current-password"
            error={errors.password?.message}
            {...register('password')}
          />
          <button
            type="submit"
            className="btn btn-primary btn-block"
            disabled={isSubmitting || countdown.remaining > 0}
          >
            {isSubmitting ? 'Signing in…' : 'Sign in'}
          </button>
        </form>
        <p className="auth-switch">
          No account? <Link to="/register">Create one</Link>
        </p>
      </div>
    </main>
  );
}
