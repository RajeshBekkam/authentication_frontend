export type AuthMessage = { type: 'logout' } | { type: 'login' } | { type: 'activity'; at: number };

let channel: BroadcastChannel | null = null;

export function openAuthChannel(onMessage: (message: AuthMessage) => void): () => void {
  if (typeof BroadcastChannel === 'undefined') return () => {};
  const ch = new BroadcastChannel('auth');
  channel = ch;
  ch.onmessage = (event: MessageEvent<unknown>) => {
    const data = event.data;
    if (data && typeof data === 'object' && 'type' in data) onMessage(data as AuthMessage);
  };
  return () => {
    ch.close();
    if (channel === ch) channel = null;
  };
}

/** Posts to every *other* tab (BroadcastChannel never echoes to the sender). */
export function broadcastAuth(message: AuthMessage): void {
  channel?.postMessage(message);
}
