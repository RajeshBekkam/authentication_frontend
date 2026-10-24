import { zodResolver } from '@hookform/resolvers/zod';
import { useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { ApiError } from '../../../api/apiFetch';
import { createRole } from '../../../api/endpoints/admin';
import { queryKeys } from '../../../api/queryKeys';
import { FormField } from '../../../components/FormField';
import { ProblemAlert } from '../../../components/ProblemAlert';
import { describeError } from '../../../lib/errors';
import { showToast } from '../../../lib/toast';
import { ROLE_NAME_PATTERN } from '../../auth/validation';

const schema = z.object({
  name: z
    .string()
    .trim()
    .regex(
      ROLE_NAME_PATTERN,
      'Use 2–64 characters: start with a letter, then letters, digits, "_", "." or "-".',
    ),
  description: z.string().trim().max(256, 'Description must be at most 256 characters.'),
});
type Values = z.infer<typeof schema>;

export function CreateRoleForm() {
  const queryClient = useQueryClient();
  const [error, setError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: { name: '', description: '' },
  });

  async function onSubmit(values: Values) {
    setError(null);
    try {
      await createRole(values.name, values.description || null);
      reset();
      showToast(`Role ${values.name} created.`, 'success');
      void queryClient.invalidateQueries({ queryKey: queryKeys.roles });
    } catch (err) {
      if (err instanceof ApiError && err.status === 409) setError('Role already exists.');
      else if (!(err instanceof ApiError && (err.status === 401 || err.status === 403)))
        setError(describeError(err));
    }
  }

  return (
    <div className="card">
      <h2>Create role</h2>
      <form onSubmit={handleSubmit(onSubmit)} noValidate className="inline-form">
        <FormField
          label="Name"
          autoComplete="off"
          error={errors.name?.message}
          {...register('name')}
        />
        <FormField
          label="Description (optional)"
          autoComplete="off"
          error={errors.description?.message}
          {...register('description')}
        />
        <button type="submit" className="btn btn-primary" disabled={isSubmitting}>
          {isSubmitting ? 'Creating…' : 'Create role'}
        </button>
      </form>
      <ProblemAlert message={error} />
    </div>
  );
}
