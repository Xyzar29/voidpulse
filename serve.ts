// A tiny static file server for playing VOIDPULSE locally:
//   node serve.ts   ->   http://localhost:8080
// It serves the game/ directory and nothing else, with the MIME types a
// browser needs for ES modules and stylesheets. Development only; the game
// itself is plain files any static server can host.

import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(fileURLToPath(new URL('.', import.meta.url)), 'game');
const port = 8080;

const MIME: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.svg': 'image/svg+xml',
};

createServer(async (request, response) => {
  try {
    const url = new URL(request.url ?? '/', 'http://localhost');
    const relative = normalize(decodeURIComponent(url.pathname)).replace(/^[/\\]+/, '');
    const filePath = join(root, relative === '' ? 'index.html' : relative);
    if (!filePath.startsWith(root)) throw new Error('outside root');
    const body = await readFile(filePath);
    response.writeHead(200, { 'content-type': MIME[extname(filePath)] ?? 'application/octet-stream' });
    response.end(body);
  } catch {
    response.writeHead(404, { 'content-type': 'text/plain' });
    response.end('not found');
  }
}).listen(port, () => {
  console.log(`VOIDPULSE at http://localhost:${port}`);
});
