// Serves the production build (dist/frontend/browser) for the end-to-end tests, like Vercel does:
// files as they are, gzip-compressed when the browser accepts it, every other path falls back to index.html
// so the Angular router can resolve it. Compression keeps the Lighthouse transfer sizes close to production.
//
// Usage: node scripts/serve-dist.mjs [port]   (default 4200, the origin the dev API allows through CORS)
import { createReadStream, existsSync, statSync } from 'node:fs';
import { createServer } from 'node:http';
import { dirname, extname, join, normalize, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createGzip } from 'node:zlib';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', 'dist', 'frontend', 'browser');
const PORT = Number(process.argv[2] ?? 4200);

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
  '.webmanifest': 'application/manifest+json',
  '.woff2': 'font/woff2',
  '.txt': 'text/plain; charset=utf-8',
};

if (!existsSync(join(ROOT, 'index.html'))) {
  console.error(`No build in ${ROOT}. Run: npm run build:e2e`);
  process.exit(1);
}

createServer((request, response) => {
  let path;
  try {
    path = decodeURIComponent(new URL(request.url ?? '/', 'http://localhost').pathname);
  } catch {
    // A malformed escape must not crash the server mid-run
    response.writeHead(400).end();
    return;
  }
  const candidate = normalize(join(ROOT, path));
  const isFile =
    candidate.startsWith(ROOT + sep) && existsSync(candidate) && statSync(candidate).isFile();
  const file = isFile ? candidate : join(ROOT, 'index.html');
  // Fonts are already compressed
  const gzip =
    /\bgzip\b/.test(request.headers['accept-encoding'] ?? '') && extname(file) !== '.woff2';
  response.writeHead(200, {
    'Content-Type': TYPES[extname(file)] ?? 'application/octet-stream',
    // Hashed bundles are immutable; index.html must always be revalidated
    'Cache-Control': file.endsWith('index.html')
      ? 'no-cache'
      : 'public, max-age=31536000, immutable',
    ...(gzip ? { 'Content-Encoding': 'gzip', Vary: 'Accept-Encoding' } : {}),
  });
  const body = createReadStream(file);
  (gzip ? body.pipe(createGzip()) : body).pipe(response);
}).listen(PORT, () => console.log(`Serving ${ROOT} on http://localhost:${PORT}`));
