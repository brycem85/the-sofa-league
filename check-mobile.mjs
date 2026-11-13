import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { Script } from 'node:vm';
import hub from './dist/server/index.js';

const request = async path => {
  const response = await hub.fetch(new Request('https://game-desk.test' + path));
  assert.equal(response.status,200,path);
  return response;
};
const manifest = await (await request('/app.webmanifest')).json();
assert.equal(manifest.display,'standalone');
assert.equal(manifest.scope,'/');
assert.equal(manifest.start_url,'/');
const icon = new Uint8Array(await (await request('/app-icon.png')).arrayBuffer());
assert.deepEqual([...icon.slice(0,8)],[137,80,78,71,13,10,26,10]);
assert.equal(new DataView(icon.buffer).getUint32(16),256);
assert.equal(new DataView(icon.buffer).getUint32(20),256);
for (const entry of manifest.icons) await request(entry.src);
for (const sport of ['hockey','football','basketball']) {
  const html = await (await request('/' + sport + '/')).text();
  assert.match(html,/viewport-fit=cover/);
  assert.match(html,/apple-touch-icon/);
  assert.match(html,/apple-mobile-web-app-capable/);
  assert.match(html,/href="#\/settings"/);
  assert.match(html,/Search settings/);
  assert.match(html,/Add Sofa League to your iPhone/);
  const ids = [...html.matchAll(/\bid="([^"]+)"/g)].map(match => match[1]);
  assert.equal(new Set(ids).size,ids.length,'Duplicate IDs in ' + sport);
  const cssPath = html.match(/href="([^\"]+desk\.css[^\"]*)"/)[1];
  const scriptPath = html.match(/src="([^\"]+desk\.js[^\"]*)"/)[1];
  const css = await (await request(cssPath)).text();
  const script = await (await request(scriptPath)).text();
  new Script(script,{filename:sport + '-client.js'});
  assert.ok(css.length > 1000,'Stylesheet missing for ' + sport);
  console.log(sport + ': HTML, client syntax, and mobile asset delivery passed');
}
const root = await hub.fetch(new Request('https://game-desk.test/',{headers:{cookie:'game_desk_sport=basketball'}}));
assert.equal(root.status,302);
assert.equal(root.headers.get('location'),'/basketball/');
const source = await readFile(new URL('shared/mobile.js',import.meta.url),'utf8');
new Script(source);
console.log('Home Screen manifest, PNG and SVG icons, and remembered-sport redirect passed');
const invalid = await hub.fetch(new Request('https://game-desk.test/not-a-sport/'));
assert.equal(invalid.status,404);
