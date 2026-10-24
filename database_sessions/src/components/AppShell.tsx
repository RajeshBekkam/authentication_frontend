import { Suspense, useEffect, useRef, useState } from 'react';
import { Link, NavLink, Outlet, useLocation } from 'react-router-dom';
import { PERMISSIONS, type Permission } from '../api/types';
import { signOut } from '../auth/session';
import { useCurrentUser } from '../auth/useMe';
import { FullPageLoader } from './Loaders';
import { SessionNotices } from './SessionNotices';

type NavItem = { to: string; label: string; perm?: Permission; end?: boolean };

const USER_NAV: NavItem[] = [
  { to: '/', label: 'Home', end: true },
  { to: '/account', label: 'Account', end: true },
  { to: '/account/sessions', label: 'Sessions' },
];

const ADMIN_NAV: NavItem[] = [
  { to: '/admin/users', label: 'Users', perm: PERMISSIONS.usersRead },
  { to: '/admin/roles', label: 'Roles & permissions', perm: PERMISSIONS.rolesRead },
  { to: '/admin/audit', label: 'Audit log', perm: PERMISSIONS.auditRead },
];

export function AppShell() {
  const me = useCurrentUser();
  const adminItems = ADMIN_NAV.filter((i) => !i.perm || me.permissions.includes(i.perm));

  return (
    <div className="shell">
      <a href="#main" className="skip-link">
        Skip to content
      </a>
      <header className="topbar">
        <Link to="/" className="brand">
          Auth Console
        </Link>
        <UserMenu email={me.email} />
      </header>
      <div className="shell-body">
        <nav className="sidenav" aria-label="Main">
          <NavList items={USER_NAV} />
          {adminItems.length > 0 && (
            <>
              <h2 className="sidenav-heading">Administration</h2>
              <NavList items={adminItems} />
            </>
          )}
        </nav>
        <main id="main" className="content" tabIndex={-1}>
          <SessionNotices absoluteExpiresUtc={me.absoluteExpiresUtc} />
          <Suspense fallback={<FullPageLoader />}>
            <Outlet />
          </Suspense>
        </main>
      </div>
    </div>
  );
}

function NavList({ items }: { items: NavItem[] }) {
  return (
    <ul>
      {items.map((i) => (
        <li key={i.to}>
          <NavLink to={i.to} end={i.end}>
            {i.label}
          </NavLink>
        </li>
      ))}
    </ul>
  );
}

function UserMenu({ email }: { email: string }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const location = useLocation();

  useEffect(() => setOpen(false), [location]);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  return (
    <div className="user-menu" ref={ref}>
      <button
        type="button"
        className="btn btn-ghost"
        aria-expanded={open}
        aria-controls="user-menu-list"
        onClick={() => setOpen((o) => !o)}
      >
        <span className="user-email">{email}</span> ▾
      </button>
      {open && (
        <ul id="user-menu-list" className="user-menu-list">
          <li>
            <Link to="/account">Account</Link>
          </li>
          <li>
            <Link to="/account/sessions">Sessions</Link>
          </li>
          <li>
            <button type="button" onClick={() => void signOut()}>
              Sign out
            </button>
          </li>
        </ul>
      )}
    </div>
  );
}
