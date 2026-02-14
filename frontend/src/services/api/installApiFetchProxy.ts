import { env } from '../../config/env';

const FLAG = '__optileno_api_fetch_proxy_installed__';

const resolveApiUrl = (url: string): string => {
  if (!url.startsWith('/api/v1/')) {
    return url;
  }
  return `${env.API_BASE_URL}${url}`;
};

export function installApiFetchProxy(): void {
  if (typeof window === 'undefined') return;

  const globalWindow = window as Window & { [FLAG]?: boolean };
  if (globalWindow[FLAG]) return;

  const originalFetch = window.fetch.bind(window);

  window.fetch = ((input: RequestInfo | URL, init?: RequestInit) => {
    if (typeof input === 'string') {
      return originalFetch(resolveApiUrl(input), init);
    }

    if (input instanceof Request) {
      const currentOrigin = window.location.origin;
      if (input.url.startsWith(`${currentOrigin}/api/v1/`)) {
        const relativePath = input.url.slice(currentOrigin.length);
        const apiRequest = new Request(resolveApiUrl(relativePath), input);
        return originalFetch(apiRequest, init);
      }
    }

    return originalFetch(input, init);
  }) as typeof window.fetch;

  globalWindow[FLAG] = true;
}
