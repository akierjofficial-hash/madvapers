import Echo from 'laravel-echo';
import Pusher from 'pusher-js';

type VoidCallback = () => void;

let echoInstance: Echo<'reverb'> | null = null;
let isChannelBound = false;
const subscribers = new Set<VoidCallback>();

function toPort(raw: string | undefined, fallback: number): number {
  const n = Number(raw);
  if (!Number.isFinite(n) || n <= 0) return fallback;
  return Math.floor(n);
}

function createEcho(): Echo<'reverb'> | null {
  const appKey = String(import.meta.env.VITE_REVERB_APP_KEY ?? '').trim();
  if (!appKey) return null;

  const host = String(import.meta.env.VITE_REVERB_HOST ?? window.location.hostname).trim();
  const scheme = String(import.meta.env.VITE_REVERB_SCHEME ?? 'http').trim().toLowerCase();
  const isTls = scheme === 'https';
  const port = toPort(import.meta.env.VITE_REVERB_PORT, isTls ? 443 : 8080);

  (window as any).Pusher = Pusher;

  return new Echo({
    broadcaster: 'reverb',
    key: appKey,
    wsHost: host,
    wsPort: port,
    wssPort: port,
    forceTLS: isTls,
    enabledTransports: ['ws', 'wss'],
  });
}

function ensureRealtimeChannel(): void {
  if (!echoInstance) {
    echoInstance = createEcho();
  }
  if (!echoInstance || isChannelBound) return;

  echoInstance.channel('approvals.queue').listen('.approval.queue.updated', () => {
    subscribers.forEach((cb) => cb());
  });
  isChannelBound = true;
}

export function subscribeApprovalQueueRealtime(onUpdate: VoidCallback): () => void {
  subscribers.add(onUpdate);
  ensureRealtimeChannel();

  return () => {
    subscribers.delete(onUpdate);
  };
}

