import { zodResolver } from '@hookform/resolvers/zod';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { Link, useNavigate } from 'react-router-dom';
import { ApiError } from '../../api/apiFetch';
import { register as registerUser } from '../../api/endpoints/auth';
import { FormField } from '../../components/FormField';
import { ProblemAlert } from '../../components/ProblemAlert';
import { describeError } from '../../lib/errors';
import { useRetryCountdown } from '../../lib/hooks';
import { PasswordStrength } from './PasswordStrength';
import { mapServerErrors, registerSchema, type RegisterValues } from './validation';

const FIELDS = ['email', 'password'] as const;

export function RegisterPage() {
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);
  const countdown = useRetryCountdown();
  const {
    register,
    handleSubmit,
    setError: setFieldError,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<RegisterValues>({ resolver: zodResolver(registerSchema), mode: 'onTouched' });

  async function onSubmit(values: RegisterValues) {
    setError(null);
    try {
      await registerUser(values.email, values.password);
      navigate('/login?registered=1', { replace: true });
    } catch (err) {
      if (err instanceof ApiError && err.status === 409) {
        setError('An account with this email already exists.');
      } else if (err instanceof ApiError && err.status === 400) {
        const { fieldErrors, other } = mapServerErrors(err.problem.errors, FIELDS);
        for (const f of FIELDS) {
          const message = fieldErrors[f];
          if (message) setFieldError(f, { type: 'server', message });
        }
        setError(
          other.length
            ? other.join(' ')
            : Object.keys(fieldErrors).length
              ? null
              : describeError(err),
        );
      } else if (err instanceof ApiError && err.status === 429) {
        countdown.start(err.retryAfter ?? 60);
      } else {
        setError(describeError(err));
      }
    }
  }

  return (
    <main className="auth-page">
      <div className="card auth-card">
        <h1>Create account</h1>
        <ProblemAlert message={error} />
        {countdown.remaining > 0 && (
          <ProblemAlert message={`Too many attempts. Try again in ${countdown.remaining} s.`} />
        )}
        <form onSubmit={handleSubmit(onSubmit)} noValidate>
          <FormField
            label="Email"
            type="email"
            autoComplete="email"
            error={errors.email?.message}
            {...register('email')}
          />
          <FormField
            label="Password"
            type="password"
            autoComplete="new-password"
            error={errors.password?.message}
            hint={<PasswordStrength password={watch('password') ?? ''} />}
            {...register('password')}
          />
          <FormField
            label="Confirm password"
            type="password"
            autoComplete="new-password"
            error={errors.confirmPassword?.message}
            {...register('confirmPassword')}
          />
          <button
            type="submit"
            className="btn btn-primary btn-block"
            disabled={isSubmitting || countdown.remaining > 0}
          >
            {isSubmitting ? 'Creating account…' : 'Create account'}
          </button>
        </form>
        <p className="auth-switch">
          Already registered? <Link to="/login">Sign in</Link>
        </p>
      </div>
    </main>
  );
}
