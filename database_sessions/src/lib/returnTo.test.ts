import { describe, expect, it } from 'vitest';
import { loginPathWithReturn, sanitizeReturnTo } from './returnTo';

describe('sanitizeReturnTo', () => {
  it.each([
    ['/account', '/account'],
    ['/admin/users?search=a&page=2', '/admin/users?search=a&page=2'],
    ['/admin/audit#top', '/admin/audit#top'],
  ])('accepts same-app path %s', (input, expected) => {
    expect(sanitizeReturnTo(input)).toBe(expected);
  });

  it.each([
    null,
    undefined,
    '',
    'account',
    'https://evil.example/',
    'http://localhost:5173/account',
    '//evil.example',
    '///evil.example',
    '/\\evil.example',
    '\\\\evil.example',
    'javascript:alert(1)',
    ' /account',
    '/acc\nount',
    '/login',
    '/register?x=1',
  ])('rejects %j', (input) => {
    expect(sanitizeReturnTo(input)).toBe('/');
  });
});

describe('loginPathWithReturn', () => {
  it('builds the login URL with returnTo and reason', () => {
    expect(loginPathWithReturn('/account/sessions', 'expired')).toBe(
      '/login?returnTo=%2Faccount%2Fsessions&reason=expired',
    );
    expect(loginPathWithReturn('/')).toBe('/login');
    expect(loginPathWithReturn('//evil')).toBe('/login');
  });
});
