export const queryKeys = {
  me: ['me'] as const,
  mySessions: ['account', 'sessions'] as const,
  users: (search: string, page: number) => ['admin', 'users', { search, page }] as const,
  usersAll: ['admin', 'users'] as const,
  user: (id: string) => ['admin', 'user', id] as const,
  userSessions: (id: string) => ['admin', 'user', id, 'sessions'] as const,
  roles: ['admin', 'roles'] as const,
  permissions: ['admin', 'permissions'] as const,
  audit: (userId: string, eventType: string) => ['admin', 'audit', { userId, eventType }] as const,
};
