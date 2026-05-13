/**
 * Cloudflare Pages: same-origin proxy for Storex Fireblocks API.
 * Browsers cannot call https://api.storex.io directly from flex.town (CORS allows storex.io only).
 *
 * Requests: https://<your-site>/api/storex/V1/fireblocks/... → https://api.storex.io/V1/fireblocks/...
 */
type Ctx = { request: Request };

export async function onRequest(context: Ctx): Promise<Response> {
  const url = new URL(context.request.url);
  const prefix = '/api/storex';
  if (!url.pathname.startsWith(prefix)) {
    return new Response('Not Found', { status: 404 });
  }

  const rest = url.pathname.slice(prefix.length) || '/';
  const target = `https://api.storex.io${rest}${url.search}`;

  return fetch(new Request(target, context.request));
}
