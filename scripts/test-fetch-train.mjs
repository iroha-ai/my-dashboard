import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { parseMetroGinza } from './fetch-train.mjs';

const line = { name_alpha: 'ginza', status_info: '平常運転', contents: '' };
const payload = JSON.stringify({ jp: { lines: [{ name_alpha: 'other' }, line] } });
let count = 0;
function test(name, fn) { fn(); count++; console.log(`ok ${count} - ${name}`); }
test('plain JSON', () => assert.deepEqual(parseMetroGinza(payload), line));
test('JSON with BOM and whitespace', () => assert.deepEqual(parseMetroGinza(`\uFEFF\n${payload}\r\n`), line));
test('legacy JSONP with semicolon', () => assert.deepEqual(parseMetroGinza(` operate_status_cb_func(${payload}); \n`), line));
test('legacy JSONP without semicolon', () => assert.deepEqual(parseMetroGinza(`operate_status_cb_func(${payload})`), line));
test('malformed input fails closed', () => assert.throws(() => parseMetroGinza('<html>error</html>')));
test('missing lines fails closed', () => assert.throws(() => parseMetroGinza('{"jp":{}}')));
test('non-array lines fails closed', () => assert.throws(() => parseMetroGinza('{"jp":{"lines":{}}}')));
test('missing Ginza fails closed', () => assert.throws(() => parseMetroGinza('{"jp":{"lines":[]}}')));
test('unexpected callback is not evaluated', () => assert.throws(() => parseMetroGinza(`evil(${payload})`)));

function run(body, ok = true) {
  const setup = `globalThis.fetch = async () => ({ ok: ${ok}, status: 503, text: async () => ${JSON.stringify(body)} });`;
  const proc = spawnSync(process.execPath, ['--import', `data:text/javascript,${encodeURIComponent(setup)}`, 'scripts/fetch-train.mjs'], { encoding: 'utf8' });
  assert.equal(proc.status, 0, proc.stderr);
  return JSON.parse(proc.stdout).items[0];
}
test('CLI emits normal state', () => assert.equal(run(payload).isNormal, true));
test('CLI emits alert state', () => assert.equal(run(JSON.stringify({ jp: { lines: [{ ...line, status_info: '遅延' }] } })).isNormal, false));
test('CLI unknown text is not normal', () => assert.equal(run(JSON.stringify({ jp: { lines: [{ ...line, status_info: '未知' }] } })).ok, false));
test('CLI invalid response is not normal', () => assert.equal(run('not json').ok, false));
test('CLI HTTP failure is not normal', () => assert.equal(run('', false).ok, false));
console.log(`${count} tests passed`);
