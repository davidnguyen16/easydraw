import { API_URL } from '@/lib/api';

/** One signed-in browser, as GET /auth/sessions reports it. */
export type AccountSession = {
  id: string;
  userAgent: string | null;
  ipAddress: string | null;
  createdAt: string;
  lastSeenAt: string;
  expiresAt: string;
  /** True for the session making the request — never offered as "sign out other". */
  current: boolean;
};

export type DeviceKind = 'phone' | 'tablet' | 'desktop';

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API_URL}${path}`, { credentials: 'include', ...init });

  if (!response.ok) {
    throw new Error(
      response.status === 401
        ? 'Your session has ended. Sign in again.'
        : 'Could not reach EasyDraw. Check your connection and try again.',
    );
  }

  return response.json() as Promise<T>;
}

export const sessionsApi = {
  list: () => request<AccountSession[]>('/auth/sessions'),
  revoke: (id: string) => request<{ revoked: boolean }>(`/auth/sessions/${id}`, { method: 'DELETE' }),
  revokeOthers: () =>
    request<{ revoked: number }>('/auth/sessions/revoke-others', { method: 'POST' }),
};

/**
 * A readable name for a browser string.
 *
 * Every browser lies in its user agent for compatibility — Edge and Opera both
 * claim to be Chrome, Chrome claims to be Safari — so the order of these tests
 * is the whole trick: the most specific claim has to be checked first.
 */
export function describeDevice(userAgent: string | null): {
  label: string;
  kind: DeviceKind;
} {
  if (!userAgent) return { label: 'Unknown device', kind: 'desktop' };

  const browser =
    /Edg\//.test(userAgent) ? 'Edge'
    : /OPR\/|Opera/.test(userAgent) ? 'Opera'
    : /SamsungBrowser/.test(userAgent) ? 'Samsung Internet'
    : /Firefox\//.test(userAgent) ? 'Firefox'
    : /Chrome\//.test(userAgent) ? 'Chrome'
    : /Safari\//.test(userAgent) ? 'Safari'
    : null;

  const system =
    /Windows NT/.test(userAgent) ? 'Windows'
    : /iPhone|iPad|iPod/.test(userAgent) ? 'iOS'
    : /Mac OS X/.test(userAgent) ? 'macOS'
    : /Android/.test(userAgent) ? 'Android'
    : /Linux/.test(userAgent) ? 'Linux'
    : null;

  const kind: DeviceKind =
    /iPad|Tablet/.test(userAgent) ? 'tablet'
    : /Mobile|iPhone|iPod|Android.*Mobile/.test(userAgent) ? 'phone'
    : 'desktop';

  if (browser && system) return { label: `${browser} on ${system}`, kind };
  return { label: browser ?? system ?? 'Unknown device', kind };
}

/**
 * How long ago, in words. The server only refreshes `lastSeenAt` about once an
 * hour, so anything finer than "just now" would be inventing precision.
 */
export function timeAgo(iso: string): string {
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return 'Unknown';

  const minutes = Math.round((Date.now() - then) / 60_000);
  if (minutes < 60) return 'Within the hour';

  const hours = Math.round(minutes / 60);
  if (hours < 24) return hours === 1 ? '1 hour ago' : `${hours} hours ago`;

  const days = Math.round(hours / 24);
  if (days === 1) return 'Yesterday';
  if (days < 30) return `${days} days ago`;

  const months = Math.round(days / 30);
  return months === 1 ? 'Last month' : `${months} months ago`;
}

/** A local address means the browser is on the same machine as the server. */
export function describeAddress(ipAddress: string | null): string | null {
  if (!ipAddress) return null;
  if (ipAddress === '::1' || ipAddress === '127.0.0.1' || ipAddress === '::ffff:127.0.0.1') {
    return 'This computer';
  }
  // Express reports IPv4 through an IPv6 socket in this form; the prefix is noise.
  return ipAddress.replace(/^::ffff:/, '');
}
