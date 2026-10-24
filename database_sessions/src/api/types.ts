// Reference types from PRD §7, verified against the backend's Contracts/Dtos.cs.
// `npm run gen:api` regenerates src/api/schema.d.ts from the live OpenAPI document; keep these in sync with it.

export type LoginResponse = {
  userId: string;
  sessionId: string;
  transport: 'cookie';
  token: null;
  csrfToken: string;
  idleExpiresUtc: string;
  absoluteExpiresUtc: string;
};

export type MeResponse = {
  userId: string;
  email: string;
  roles: string[];
  permissions: string[];
  sessionId: string;
  transport: 'cookie' | 'bearer';
  csrfToken: string | null;
  absoluteExpiresUtc: string;
};

export type SessionResponse = {
  id: string;
  transport: string;
  createdUtc: string;
  lastSeenUtc: string;
  idleExpiresUtc: string;
  absoluteExpiresUtc: string;
  revokedUtc: string | null;
  revokedReason: string | null;
  ipAddress: string | null;
  userAgent: string | null;
  isCurrent: boolean;
};

export type UserSummary = {
  id: string;
  email: string;
  isDisabled: boolean;
  disabledAtUtc: string | null;
  isLockedOut: boolean;
  lockoutEndUtc: string | null;
  createdUtc: string;
};

export type UserDetail = {
  user: UserSummary;
  roles: string[];
  permissions: string[];
  failedLoginCount: number;
  passwordChangedUtc: string;
};

export type Paged<T> = { items: T[]; page: number; pageSize: number; total: number };

export type RoleResponse = {
  name: string;
  description: string | null;
  isSystem: boolean;
  permissions: string[];
};

export type PermissionResponse = { id: number; name: string; description: string | null };

export type AuditRecord = {
  id: number;
  occurredUtc: string;
  eventType: string;
  userId: string | null;
  actorUserId: string | null;
  sessionId: string | null;
  ipAddress: string | null;
  userAgent: string | null;
  details: string | null; // JSON string
};

export type RevokedCount = { revoked: number };

export type ProblemDetails = {
  status: number;
  title: string;
  detail?: string;
  errors?: Record<string, string[]>;
};

export const PERMISSIONS = {
  usersRead: 'users.read',
  usersManage: 'users.manage',
  rolesAssign: 'roles.assign',
  rolesRead: 'roles.read',
  rolesManage: 'roles.manage',
  sessionsRead: 'sessions.read',
  sessionsRevoke: 'sessions.revoke',
  auditRead: 'audit.read',
} as const;

export type Permission = (typeof PERMISSIONS)[keyof typeof PERMISSIONS];

export const ADMIN_ROLE = 'Admin';

export const AUDIT_EVENT_TYPES = [
  'user.registered',
  'login.succeeded',
  'login.failed',
  'login.blocked_locked_out',
  'login.blocked_disabled',
  'account.locked_out',
  'account.disabled',
  'account.enabled',
  'account.unlocked',
  'password.changed',
  'password.change_failed',
  'session.logout',
  'session.revoked',
  'session.revoked_all',
  'session.evicted',
  'user.roles_changed',
  'role.created',
  'role.permissions_changed',
] as const;
