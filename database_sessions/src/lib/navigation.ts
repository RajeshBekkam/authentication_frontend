// Lets non-React code (apiFetch handlers, the auth BroadcastChannel) navigate via the data router.
type Navigator = (to: string, opts?: { replace?: boolean }) => void;

let navigator: Navigator = (to) => window.location.assign(to);

export function setNavigator(next: Navigator): void {
  navigator = next;
}

export function navigateTo(to: string, opts?: { replace?: boolean }): void {
  navigator(to, opts);
}

export function currentPath(): string {
  return window.location.pathname + window.location.search;
}
