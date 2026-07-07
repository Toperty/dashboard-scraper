// Interceptor global de `fetch`.
//
// El scraper no tiene un cliente API central: cada componente hace su propio `fetch`.
// En vez de tocar decenas de llamadas, parcheamos `window.fetch` UNA vez para:
//   1. Adjuntar `Authorization: Bearer <session_token>` a las llamadas al backend.
//   2. Emitir un evento `api-readonly-blocked` cuando el backend responde 403
//      (cuenta de solo lectura), para que la UI muestre un aviso.
//
// Solo afecta a las URLs del backend (API_BASE_URL / rutas `/api`); las peticiones
// internas de Next quedan intactas.

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

function urlOf(input: RequestInfo | URL): string {
  if (typeof input === 'string') return input;
  if (input instanceof URL) return input.href;
  return input.url;
}

function isApiUrl(url: string): boolean {
  return url.startsWith(API_BASE_URL) || url.startsWith('/api/');
}

export function installApiInterceptor(): void {
  if (typeof window === 'undefined') return;
  const w = window as unknown as { __apiInterceptorInstalled?: boolean };
  if (w.__apiInterceptorInstalled) return;
  w.__apiInterceptorInstalled = true;

  const originalFetch = window.fetch.bind(window);

  window.fetch = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const url = urlOf(input);
    const api = isApiUrl(url);

    if (api) {
      const token = localStorage.getItem('session_token');
      if (token) {
        const headers = new Headers(
          init?.headers ??
            (typeof input !== 'string' && !(input instanceof URL) ? input.headers : undefined),
        );
        if (!headers.has('Authorization')) {
          headers.set('Authorization', `Bearer ${token}`);
        }
        init = { ...init, headers };
      }
    }

    const response = await originalFetch(input, init);

    if (api && response.status === 403) {
      try {
        window.dispatchEvent(new CustomEvent('api-readonly-blocked'));
      } catch {
        /* noop */
      }
    }
    return response;
  };
}
