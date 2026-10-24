import { describe, expect, it } from 'vitest';
import { ROLE_NAME_PATTERN, mapServerErrors, passwordIssues, registerSchema } from './validation';

// Expected messages copied from the backend's CredentialRules.ValidatePassword.
describe('passwordIssues mirrors CredentialRules', () => {
  const email = 'someone@example.com';

  it('accepts a 12+ character varied password', () => {
    expect(passwordIssues('correct horse battery', email)).toEqual([]);
    expect(passwordIssues('abcdabcdabcd', email)).toEqual([]); // exactly 12, 4 distinct
  });

  it('enforces 12–128 characters', () => {
    expect(passwordIssues('abcdefghijk', email)).toEqual([
      'Password must be at least 12 characters.',
    ]);
    expect(passwordIssues('abcd'.repeat(32) + 'e', email)).toEqual([
      'Password must be at most 128 characters.',
    ]);
    expect(passwordIssues('abcd'.repeat(32), email)).toEqual([]);
  });

  it('rejects the email as password, case- and whitespace-insensitively', () => {
    expect(passwordIssues(' SomeOne@Example.com ', email)).toContain(
      'Password must not be the same as the email address.',
    );
  });

  it('requires at least 4 distinct characters', () => {
    expect(passwordIssues('abcabcabcabc', email)).toEqual(['Password is too repetitive.']);
    expect(passwordIssues('aaaaaaaaaaaa', email)).toEqual(['Password is too repetitive.']);
  });

  it('reports multiple issues in backend order', () => {
    expect(passwordIssues('aaa', email)).toEqual([
      'Password must be at least 12 characters.',
      'Password is too repetitive.',
    ]);
  });
});

describe('registerSchema', () => {
  const valid = {
    email: 'a@b.co',
    password: 'a long passphrase',
    confirmPassword: 'a long passphrase',
  };

  it('accepts valid input', () => {
    expect(registerSchema.safeParse(valid).success).toBe(true);
  });

  it('validates email format and 256-char limit', () => {
    expect(registerSchema.safeParse({ ...valid, email: 'nope' }).success).toBe(false);
    const long = `${'a'.repeat(245)}@example.com`; // 257 chars
    expect(registerSchema.safeParse({ ...valid, email: long }).success).toBe(false);
  });

  it('requires matching confirmation', () => {
    const r = registerSchema.safeParse({ ...valid, confirmPassword: 'different value!' });
    expect(r.success).toBe(false);
    expect(r.error?.issues[0]?.path).toEqual(['confirmPassword']);
  });
});

describe('mapServerErrors', () => {
  it('maps ProblemDetails keys onto fields case-insensitively', () => {
    const { fieldErrors, other } = mapServerErrors(
      { Password: ['Too short.', 'Too repetitive.'], '$.email': ['Bad email.'], Other: ['Huh.'] },
      ['email', 'password'] as const,
    );
    expect(fieldErrors).toEqual({ password: 'Too short. Too repetitive.', email: 'Bad email.' });
    expect(other).toEqual(['Huh.']);
  });
});

describe('role name pattern mirrors CreateRoleRequest', () => {
  it.each(['Ops', 'support_tier.1', 'a-b'])('accepts %s', (n) =>
    expect(ROLE_NAME_PATTERN.test(n)).toBe(true),
  );
  it.each(['A', '1abc', '-abc', 'has space', 'x'.repeat(65)])('rejects %s', (n) =>
    expect(ROLE_NAME_PATTERN.test(n)).toBe(false),
  );
});
