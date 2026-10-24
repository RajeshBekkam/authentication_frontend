import { z } from 'zod';

// Mirrors the backend's CredentialRules / RegisterRequest exactly. The server re-validates; this is UX only.
export const MIN_PASSWORD_LENGTH = 12;
export const MAX_PASSWORD_LENGTH = 128;
export const MAX_EMAIL_LENGTH = 256;
/** Mirrors CreateRoleRequest.Name. */
export const ROLE_NAME_PATTERN = /^[A-Za-z][A-Za-z0-9_.-]{1,63}$/;

/** Same messages, same order as CredentialRules.ValidatePassword. */
export function passwordIssues(password: string, email: string): string[] {
  const issues: string[] = [];
  // .length counts UTF-16 code units, like C#'s string.Length.
  if (password.length < MIN_PASSWORD_LENGTH)
    issues.push(`Password must be at least ${MIN_PASSWORD_LENGTH} characters.`);
  if (password.length > MAX_PASSWORD_LENGTH)
    issues.push(`Password must be at most ${MAX_PASSWORD_LENGTH} characters.`);
  if (email.trim() !== '' && password.trim().toLowerCase() === email.trim().toLowerCase())
    issues.push('Password must not be the same as the email address.');
  if (new Set(password.split('')).size < 4) issues.push('Password is too repetitive.');
  return issues;
}

/**
 * Advisory strength score 0–4 for the hint. Length-led like the backend's NIST-style policy; it
 * never adds composition rules, it only rewards length and variety and nudges away from repetition.
 */
export function estimateStrength(password: string): number {
  if (password.length < MIN_PASSWORD_LENGTH) return 0;
  const distinct = new Set(password).size;
  let score = 1;
  if (password.length >= 16) score++;
  if (password.length >= 20) score++;
  if (distinct >= 10) score++;
  if (distinct < password.length / 3) score--;
  return Math.max(1, Math.min(4, score));
}

export const emailSchema = z
  .string()
  .trim()
  .min(1, 'Email is required.')
  .max(MAX_EMAIL_LENGTH, `Email must be at most ${MAX_EMAIL_LENGTH} characters.`)
  .email('Enter a valid email address.');

export const registerSchema = z
  .object({
    email: emailSchema,
    password: z.string(),
    confirmPassword: z.string(),
  })
  .superRefine((v, ctx) => {
    for (const message of passwordIssues(v.password, v.email)) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['password'], message });
    }
    if (v.confirmPassword !== v.password) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['confirmPassword'],
        message: 'Passwords do not match.',
      });
    }
  });
export type RegisterValues = z.infer<typeof registerSchema>;

export const loginSchema = z.object({
  email: z.string().trim().min(1, 'Email is required.').max(MAX_EMAIL_LENGTH),
  password: z.string().min(1, 'Password is required.'),
});
export type LoginValues = z.infer<typeof loginSchema>;

/** The backend only knows the email for the new-password check via the session's user. */
export function changePasswordSchema(email: string) {
  return z
    .object({
      currentPassword: z.string().min(1, 'Current password is required.'),
      newPassword: z.string(),
      confirmPassword: z.string(),
    })
    .superRefine((v, ctx) => {
      for (const message of passwordIssues(v.newPassword, email)) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['newPassword'], message });
      }
      if (v.confirmPassword !== v.newPassword) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['confirmPassword'],
          message: 'Passwords do not match.',
        });
      }
    });
}
export type ChangePasswordValues = z.infer<ReturnType<typeof changePasswordSchema>>;

/** Map ProblemDetails `errors` (keys like "Password", "$.email") onto form fields. */
export function mapServerErrors<F extends string>(
  errors: Record<string, string[]> | undefined,
  fields: readonly F[],
): { fieldErrors: Partial<Record<F, string>>; other: string[] } {
  const fieldErrors: Partial<Record<F, string>> = {};
  const other: string[] = [];
  for (const [key, messages] of Object.entries(errors ?? {})) {
    const normalized = key.replace(/^\$\./, '').toLowerCase();
    const field = fields.find((f) => f.toLowerCase() === normalized);
    if (field) fieldErrors[field] = messages.join(' ');
    else other.push(...messages);
  }
  return { fieldErrors, other };
}
