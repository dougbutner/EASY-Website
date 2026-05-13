/**
 * Cloudflare Pages: proxy Storex Fireblocks API under same origin so browser requests are not blocked by CORS
 * (api.storex.io responds with Access-Control-Allow-Origin: https://storex.io only).
 *
 * Client uses `${origin}/api/storex/V1/fireblocks/...` — see `getStorexApiBase()` in `src/services/storexBridge.ts`.
 */
type PagesMiddlewareContext = {
  request: Request;
  next: () => Promise<Response>;
};

export async function onRequest(context: PagesMiddlewareContext): Promise<Response> {
  const url = new URL(context.request.url);
  if (!url.pathname.startsWith("/api/storex")) {
    return context.next();
  }

  const rest = url.pathname.slice("/api/storex".length);
  const target = `https://api.storex.io${rest || ""}${url.search}`;

  const proxyRequest = new Request(target, context.request);
  return fetch(proxyRequest);
}
