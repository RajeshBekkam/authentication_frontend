import { zodResolver } from '@hookform/resolvers/zod';
import { useQueryClient } from '@tanstack/react-query';
import { useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import { ApiError } from '../../api/apiFetch';
import { changePassword } from '../../api/endpoints/account';
import { queryKeys } from '../../api/queryKeys';
import { FormField } from '../../components/FormField';
import { ProblemAlert } from '../../components/ProblemAlert';
import { describeError } from '../../lib/errors';
import { useRetryCountdown } from '../../lib/hooks';
import { showToast } from '../../lib/toast';
import { PasswordStrength } from '../auth/PasswordStrength';
import {
  changePasswordSchema,
  mapServerErrors,
  type ChangePasswordValues,
} from '../auth/validation';

const SERVER_FIELDS = ['currentPassword', 'newPassword'] as const;

export function ChangePasswordForm({ email }: { email: string }) {
  const queryClient = useQueryClient();
  const [error, setError] = useState<string | null>(null);
  const countdown = useRetryCountdown();
  const schema = useMemo(() => changePasswordSchema(email), [email]);
  const {
    register,
    handleSubmit,
    reset,
    watch,
    setError: setFieldError,
    formState: { errors, isSubmitting },
  } = useForm<ChangePasswordValues>({ resolver: zodResolver(schema), mode: 'onTouched' });

  async function onSubmit(values: ChangePasswordValues) {
    setError(null);
    try {
      await changePassword(values.currentPassword, values.newPassword);
      reset();
      showToast('Password changed. All other sessions were signed out.', 'success');
      void queryClient.invalidateQueries({ queryKey: queryKeys.mySessions });
      void queryClient.invalidateQueries({ queryKey: queryKeys.me });
    } catch (err) {
      if (
        err instanceof ApiError &&
        err.status === 400 &&
        err.problem.title === 'Current password is incorrect'
      ) {
        setFieldError('currentPassword', {
          type: 'server',
          message: 'Current password is incorrect.',
        });
      } else if (err instanceof ApiError && err.status === 400) {
        const { fieldErrors, other } = mapServerErrors(err.problem.errors, SERVER_FIELDS);
        for (const f of SERVER_FIELDS) {
          const message = fieldErrors[f];
          if (message) setFieldError(f, { type: 'server', message });
        }
        if (other.length) setError(other.join(' '));
        else if (!Object.keys(fieldErrors).length) setError(describeError(err));
      } else if (err instanceof ApiError && err.status === 429) {
        countdown.start(err.retryAfter ?? 60);
      } else if (!(err instanceof ApiError && (err.status === 401 || err.status === 403))) {
        // 401/403 are handled globally; everything else is shown here and the form keeps its values.
        setError(describeError(err));
      }
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate className="narrow-form">
      <ProblemAlert message={error} />
      {countdown.remaining > 0 && (
        <ProblemAlert message={`Too many attempts. Try again in ${countdown.remaining} s.`} />
      )}
      <FormField
        label="Current password"
        type="password"
        autoComplete="current-password"
        error={errors.currentPassword?.message}
        {...register('currentPassword')}
      />
      <FormField
        label="New password"
        type="password"
        autoComplete="new-password"
        error={errors.newPassword?.message}
        hint={<PasswordStrength password={watch('newPassword') ?? ''} />}
        {...register('newPassword')}
      />
      <FormField
        label="Confirm new password"
        type="password"
        autoComplete="new-password"
        error={errors.confirmPassword?.message}
        {...register('confirmPassword')}
      />
      <button
        type="submit"
        className="btn btn-primary"
        disabled={isSubmitting || countdown.remaining > 0}
      >
        {isSubmitting ? 'Changing…' : 'Change password'}
      </button>
    </form>
  );
}
