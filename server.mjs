import http from 'node:http';
import { existsSync } from 'node:fs';

const bundle = new URL('./dist/server/index.js', import.meta.url);
if (!existsSync(bundle)) throw new Error('Build the app first: node build.mjs');
const { default: hub } = await import(bundle.href);
const port = Number(process.env.PORT || 4176);
if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('PORT must be between 1 and 65535.');
const origin = 'http://127.0.0.1:' + port;
const server = http.createServer(async (request, response) => {
  if (!['GET', 'HEAD'].includes(request.method)) { response.writeHead(405); response.end('Method not allowed'); return; }
  try {
    const result = await hub.fetch(new Request(new URL(request.url, origin), { method: request.method, headers: request.headers }));
    response.writeHead(result.status, Object.fromEntries(result.headers));
    response.end(Buffer.from(await result.arrayBuffer()));
  } catch (error) {
    console.error('Request failed:', error.message);
    response.writeHead(500, { 'content-type': 'text/plain' });
    response.end('Request failed. Check the server terminal.');
  }
});
server.listen(port, '127.0.0.1', () => console.log('The Sofa League: ' + origin));
