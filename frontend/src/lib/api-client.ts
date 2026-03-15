const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8080';

function buildURL(path: string) {
  const base = API_URL.endsWith('/') ? API_URL.slice(0, -1) : API_URL;
  const route = path.startsWith('/') ? path : `/${path}`;
  return `${base}${route}`;
}

async function resolveAccessToken() {
  const { createClient } = await import('./supabase');
  const supabase = createClient();

  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (session?.access_token) {
    return { token: session.access_token, supabase };
  }

  // If access token is missing but refresh cookie/token exists, try to refresh once.
  const { data: refreshed } = await supabase.auth.refreshSession();
  return { token: refreshed.session?.access_token, supabase };
}

export async function apiFetch(path: string, options?: RequestInit) {
  const { token, supabase } = await resolveAccessToken();
  const url = buildURL(path);

  const makeRequest = (bearer?: string) =>
    fetch(url, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...(bearer ? { Authorization: `Bearer ${bearer}` } : {}),
        ...options?.headers,
      },
    });

  let response = await makeRequest(token);

  // Token may have expired between reads. Refresh and retry one time.
  if (response.status === 401) {
    const { data: refreshed } = await supabase.auth.refreshSession();
    const refreshedToken = refreshed.session?.access_token;
    if (refreshedToken) {
      response = await makeRequest(refreshedToken);
    }
  }

  return response;
}
