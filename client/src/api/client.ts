let accessToken: string | null = null;

export function setAccessToken(token: string | null) {
  accessToken = token;
}

async function refreshAccessToken(): Promise<string | null> {
  const res = await fetch('/api/auth/refresh', { method: 'POST', credentials: 'include' });
  if (!res.ok) return null;
  const data = await res.json();
  accessToken = data.accessToken;
  return accessToken;
}

export async function apiFetch(path: string, options: RequestInit = {}): Promise<Response> {
  const headers: Record<string, string> = {
    ...(options.headers as Record<string, string>),
  };
  if (!(options.body instanceof FormData)) {
    headers['Content-Type'] = 'application/json';
  }
  if (accessToken) headers['Authorization'] = `Bearer ${accessToken}`;

  let res = await fetch(path, { ...options, headers, credentials: 'include' });

  if (res.status === 401 && path !== '/api/auth/login') {
    const newToken = await refreshAccessToken();
    if (newToken) {
      headers['Authorization'] = `Bearer ${newToken}`;
      res = await fetch(path, { ...options, headers, credentials: 'include' });
    }
  }
  return res;
}
