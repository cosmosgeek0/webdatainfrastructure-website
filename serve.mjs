// Public pages and the three aggregate-only API paths. No private dashboard.
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { resolve, extname } from 'node:path';

const root = fileURLToPath(new URL('./public/', import.meta.url));
const pages = new Set(['about', 'contact', 'privacy', 'terms']);
const apiPaths = new Set(['/api/live', '/api/seconds', '/api/minutes']);
const queryKeys = new Set(['from', 'to', 'step', 'window', 'since_rev', 'detail_from', 'detail_to', 'service']);
const upstream = process.env.METRICS_ORIGIN ? new URL(process.env.METRICS_ORIGIN) : null;
if (upstream && (!['http:', 'https:'].includes(upstream.protocol) || upstream.username || upstream.password)) {
  throw new Error('METRICS_ORIGIN must be an HTTP(S) origin without credentials');
}
const types = {
  '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8', '.svg': 'image/svg+xml',
  '.png': 'image/png', '.ico': 'image/x-icon', '.jpg': 'image/jpeg',
  '.woff2': 'font/woff2', '.xml': 'application/xml', '.txt': 'text/plain; charset=utf-8',
};
const headers = {
  'X-Content-Type-Options': 'nosniff', 'X-Frame-Options': 'DENY',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
  'Content-Security-Policy': "default-src 'none'; script-src 'self'; style-src 'self' 'unsafe-inline'; font-src 'self'; img-src 'self' data:; connect-src 'self' https://formsubmit.co; base-uri 'none'; frame-ancestors 'none'; form-action 'none'",
};
createServer(async (request, response) => {
  function reply(status, content, type = 'application/json', extra = {}) {
    response.writeHead(status, { ...headers, 'Content-Type': type, 'Cache-Control': 'no-store', ...extra });
    response.end(request.method === 'HEAD' ? undefined : content);
  }
  try {
    if (!['GET', 'HEAD'].includes(request.method)) return reply(405, '{"error":"Method not allowed"}', undefined, { Allow: 'GET, HEAD' });
    const url = new URL(request.url, 'http://local.invalid');
    if (apiPaths.has(url.pathname)) {
      if (!upstream) return reply(503, '{"error":"Measurement source unavailable"}');
      for (const [key, value] of url.searchParams) {
        if (!queryKeys.has(key) || url.searchParams.getAll(key).length !== 1 || (key === 'service' && value !== 'all')) {
          return reply(400, '{"error":"Unsupported aggregate query"}');
        }
      }
      const target = new URL(upstream.origin);
      target.pathname = url.pathname;
      target.search = url.search;
      const result = await fetch(target, { signal: AbortSignal.timeout(7000), redirect: 'error' });
      if (!result.ok || !result.headers.get('content-type')?.includes('application/json')) {
        return reply(502, '{"error":"Measurement source unavailable"}');
      }
      return reply(200, JSON.stringify(await result.json()));
    }
    let name = decodeURIComponent(url.pathname).replace(/^\//, '');
    if (!name || name === 'index.html') name = 'index.html';
    else if (pages.has(name.replace(/\/$/, ''))) name = name.replace(/\/$/, '') + '.html';
    // Production public assets are flat; never expose source, credentials or directories.
    if (name.includes('/') || name.includes('\\') || name.startsWith('.') || !types[extname(name)]) return reply(404, '{"error":"Not found"}');
    const body = await readFile(resolve(root, name));
    reply(200, body, types[extname(name)], { 'Cache-Control': 'public, max-age=60' });
  } catch (error) {
    reply(error.code === 'ENOENT' ? 404 : 502, '{"error":"Resource unavailable"}');
  }
}).listen(Number(process.env.PORT || 8080), process.env.HOST || '127.0.0.1', () => console.log('WDI public website ready'));
