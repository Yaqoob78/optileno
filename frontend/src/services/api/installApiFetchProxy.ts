import { env } from '../../config/env';

const FLAG = '__optileno_api_fetch_proxy_installed__';

const resolveApiUrl = (url: string): string => {
  if (!url.startsWith('/api/v1/')) {
    return url;
  }
  return `${env.API_BASE_URL}${url}`;
};

const getAccessToken = (): string | null => {
  const candidates = ['access_token', 'auth_token', 'token'];
  for (const key of candidates) {
    const value = localStorage.getItem(key);
    if (value && value !== 'null' && value !== 'undefined') {
      return value;
    }
  }
  return null;
};

const applyAuthDefaults = (headersInput: HeadersInit | undefined): Headers => {
  const headers = new Headers(headersInput);

  if (!headers.has('Authorization')) {
    const token = getAccessToken();
    if (token) {
      headers.set('Authorization', `Bearer ${token}`);
    }
  }

  return headers;
};

export function installApiFetchProxy(): void {
  if (typeof window === 'undefined') return;

  const globalWindow = window as Window & { [FLAG]?: boolean };
  if (globalWindow[FLAG]) return;

  const originalFetch = window.fetch.bind(window);

  window.fetch = ((input: RequestInfo | URL, init?: RequestInit) => {
    if (typeof input === 'string') {
      if (!input.startsWith('/api/v1/')) {
        return originalFetch(input, init);
      }

      const nextInit: RequestInit = {
        ...init,
        credentials: init?.credentials ?? 'include',
        headers: applyAuthDefaults(init?.headers),
      };

      return originalFetch(resolveApiUrl(input), nextInit);
    }

    if (input instanceof Request) {
      const currentOrigin = window.location.origin;
      if (input.url.startsWith(`${currentOrigin}/api/v1/`)) {
        const relativePath = input.url.slice(currentOrigin.length);
        const apiRequest = new Request(resolveApiUrl(relativePath), input);
        const nextInit: RequestInit = {
          ...init,
          credentials: init?.credentials ?? apiRequest.credentials ?? 'include',
          headers: applyAuthDefaults(init?.headers ?? apiRequest.headers),
        };
        return originalFetch(apiRequest, nextInit);
      }
    }

    return originalFetch(input, init);
  }) as typeof window.fetch;

  globalWindow[FLAG] = true;
}
