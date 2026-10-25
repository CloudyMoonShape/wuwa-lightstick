import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash, randomUUID} from 'node:crypto';
import {readFileSync} from 'node:fs';
import {DatabaseSync} from 'node:sqlite';
import {runInNewContext} from 'node:vm';
import {onRequest} from '../functions/api/visitors.js';

const ORIGIN = 'https://wuwa.south-wall.com';
const OTHER_ORIGIN = 'https://wuwa-resonator.pages.dev';
const ID = '12345678-1234-4234-8234-123456789abc';
const KEY = 'wuwa.visitor.v1';
const migration = readFileSync(new URL('../migrations/0001_visitors.sql', import.meta.url), 'utf8');
const client = readFileSync(new URL('../web/visitors.js', import.meta.url), 'utf8');

// Exercise the actual SQL and trigger with SQLite, while adapting the small D1 API used here.
// D1 runtime/binding behavior still needs an isolated Cloudflare integration check.
class SqliteD1 {
  constructor(t) {
    this.sql = new DatabaseSync(':memory:'); this.queries = [];
    this.sql.exec(migration); t.after(() => this.sql.close());
  }
  prepare(query) {
    this.queries.push(query);
    const statement = this.sql.prepare(query); let args = [];
    return {
      bind(...values) { args = values; return this; },
      async first(column) {
        const row = statement.get(...args);
        return (column ? row?.[column] : row) ?? null;
      },
      execute() { return {success: true, results: statement.all(...args)}; }
    };
  }
  async batch(statements) {
    this.sql.exec('BEGIN');
    try {
      const results = statements.map((statement, i) => {
        if (this.failRead && i === 1) throw new Error('simulated read failure');
        return statement.execute();
      });
      this.sql.exec('COMMIT'); return results;
    } catch (error) { this.sql.exec('ROLLBACK'); throw error; }
  }
}

function request(db, {method = 'POST', id = ID, urlOrigin = ORIGIN, headers = {}, body} = {}) {
  const init = {method, headers: {'Origin': urlOrigin, 'Content-Type': 'application/json', ...headers}};
  if (!['GET', 'HEAD'].includes(method)) init.body = body === undefined ? JSON.stringify({id}) : body;
  return onRequest({request: new Request(`${urlOrigin}/api/visitors`, init), env: {VISITORS_DB: db}});
}

test('visitor count starts at zero and GET never scans the visitor table', async t => {
  const db = new SqliteD1(t), response = await request(db, {method: 'GET'});
  assert.equal(response.status, 200); assert.deepEqual(await response.json(), {total: 0});
  assert.equal(response.headers.get('Cache-Control'), 'no-store');
  assert.equal(response.headers.get('CDN-Cache-Control'), 'no-store');
  assert.equal(response.headers.get('Access-Control-Allow-Origin'), null);
  assert.deepEqual(db.queries, ['SELECT total FROM visitor_totals WHERE id = 1']);
});

test('valid visitors increment once; only a normalized SHA-256 is stored', async t => {
  const db = new SqliteD1(t);
  for (const origin of [ORIGIN, OTHER_ORIGIN]) {
    const response = await request(db, {id: ID.toUpperCase(), urlOrigin: origin});
    assert.equal(response.status, 200); assert.deepEqual(await response.json(), {total: 1});
  }
  const rows = db.sql.prepare('SELECT * FROM visitor_ids').all();
  assert.deepEqual(Object.keys(rows[0]), ['id_hash']);
  assert.equal(rows.length, 1);
  assert.equal(rows[0].id_hash, createHash('sha256').update(ID).digest('hex'));
  const response = await request(db, {id: randomUUID()});
  assert.deepEqual(await response.json(), {total: 2});
  db.sql.exec(migration);
  assert.deepEqual(await (await request(db, {method: 'GET'})).json(), {total: 2});
});

test('concurrent duplicate requests and distinct visitors preserve one total per ID', async t => {
  const db = new SqliteD1(t);
  const duplicate = await Promise.all(Array.from({length: 32}, () => request(db)));
  for (const response of duplicate) {
    assert.equal(response.status, 200); assert.deepEqual(await response.json(), {total: 1});
  }
  const ids = Array.from({length: 12}, () => randomUUID());
  const mixed = await Promise.all(ids.flatMap(id => [request(db, {id}), request(db, {id})]));
  assert(mixed.every(response => response.status === 200));
  assert.deepEqual(await (await request(db, {method: 'GET'})).json(), {total: 13});
  assert.equal(db.sql.prepare('SELECT COUNT(*) AS n FROM visitor_ids').get().n, 13);
});

test('a failed batch rolls back both ID insertion and the trigger increment', async t => {
  const db = new SqliteD1(t); db.failRead = true;
  const response = await request(db);
  assert.equal(response.status, 503); assert.deepEqual(await response.json(), {error: 'unavailable'});
  assert.equal(db.sql.prepare('SELECT COUNT(*) AS n FROM visitor_ids').get().n, 0);
  assert.equal(db.sql.prepare('SELECT total FROM visitor_totals').get().total, 0);
  db.failRead = false;
  assert.deepEqual(await (await request(db)).json(), {total: 1});
});

test('invalid JSON, UUIDs and extra fields are rejected before database access', async t => {
  const db = new SqliteD1(t);
  const bodies = ['{', 'null', '[]', '{}', JSON.stringify({id: 'not-a-uuid'}),
    JSON.stringify({id: ID.replace('-4', '-1')}), JSON.stringify({id: ID, extra: 'ignored?'}),
    JSON.stringify({id: 12}), new Uint8Array([0xff])];
  for (const body of bodies) assert.equal((await request(db, {body})).status, 400);
  assert.equal(db.queries.length, 0);
});

test('body size is bounded with or without an honest Content-Length', async t => {
  const db = new SqliteD1(t);
  for (const headers of [{}, {'Content-Length': '1'}, {'Content-Length': '257'}]) {
    assert.equal((await request(db, {body: ' '.repeat(257), headers})).status, 413);
  }
  assert.equal((await request(db, {headers: {'Content-Length': '-1'}})).status, 400);
  assert.equal(db.queries.length, 0);
});

test('a chunked oversized body is cancelled without reading its remaining chunks', async t => {
  const db = new SqliteD1(t); let cancelled = false;
  const body = new ReadableStream({
    start(controller) { controller.enqueue(new Uint8Array(128)); controller.enqueue(new Uint8Array(129)); },
    cancel() { cancelled = true; }
  });
  const response = await onRequest({env: {VISITORS_DB: db}, request: new Request(`${ORIGIN}/api/visitors`, {
    method: 'POST', headers: {Origin: ORIGIN, 'Content-Type': 'application/json'}, body, duplex: 'half'
  })});
  assert.equal(response.status, 413); assert.equal(cancelled, true); assert.equal(db.queries.length, 0);
});

test('POST requires exact same-origin JSON, and previews cannot access the database', async t => {
  const db = new SqliteD1(t);
  for (const origin of ['', 'null', OTHER_ORIGIN, 'https://evil.example']) {
    assert.equal((await request(db, {headers: {Origin: origin}})).status, 403);
  }
  const noOrigin = new Request(`${ORIGIN}/api/visitors`, {
    method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({id: ID})
  });
  assert.equal((await onRequest({request: noOrigin, env: {VISITORS_DB: db}})).status, 403);
  for (const type of ['', 'text/plain', 'application/x-www-form-urlencoded']) {
    assert.equal((await request(db, {headers: {'Content-Type': type}})).status, 415);
  }
  for (const origin of ['http://localhost:8788', 'https://preview.wuwa-resonator.pages.dev', 'http://wuwa.south-wall.com']) {
    assert.equal((await request(db, {urlOrigin: origin})).status, 404);
    assert.equal((await request(db, {method: 'GET', urlOrigin: origin})).status, 404);
  }
  const method = await request(db, {method: 'DELETE'});
  assert.equal(method.status, 405); assert.equal(method.headers.get('Allow'), 'GET, POST');
  assert.equal(db.queries.length, 0);
});

test('missing binding, missing schema and database failures return a generic uncached 503', async t => {
  const broken = new SqliteD1(t); broken.sql.exec('DROP TABLE visitor_totals');
  const throwing = {prepare() { throw new Error('private database diagnostics'); }};
  for (const db of [undefined, broken, throwing]) for (const method of ['GET', 'POST']) {
    const response = await request(db, {method});
    assert.equal(response.status, 503); assert.deepEqual(await response.json(), {error: 'unavailable'});
    assert.equal(response.headers.get('Cache-Control'), 'no-store');
  }
});

function browser({origin = ORIGIN, loading = false, store = new Map(), storageThrows = false,
  persist = true, fetchImpl = async () => Response.json({total: 1234}), locks,
  createId = () => ID, node = {hidden: false, textContent: ''}} = {}) {
  const value = {textContent: ''};
  const calls = [], timers = []; let domReady, storageReads = 0;
  const context = {
    document: {readyState: loading ? 'loading' : 'complete', getElementById: id => id === 'visitorTotal' ? value : node,
      addEventListener(name, listener, options) {
        assert.equal(name, 'DOMContentLoaded'); assert.equal(options.once, true); domReady = listener;
      }},
    location: {origin}, navigator: {locks}, crypto: {randomUUID: createId}, AbortController,
    localStorage: {
      getItem(key) { storageReads++; if (storageThrows) throw new Error('storage blocked'); return store.get(key) ?? null; },
      setItem(key, value) { if (storageThrows) throw new Error('storage blocked'); if (persist) store.set(key, value); }
    },
    setTimeout(fn, delay) { const timer = {fn, delay, cleared: false}; timers.push(timer); return timer; },
    clearTimeout(timer) { if (timer) timer.cleared = true; },
    fetch(url, options) { calls.push({url, options}); return fetchImpl(url, options); }
  };
  runInNewContext(client, context);
  return {node, value, calls, timers, store, ready: () => domReady(), reads: () => storageReads,
    async run() { const timer = timers.find(item => item.delay === 0); if (timer) await timer.fn(); }};
}

test('browser waits for DOM ready, saves one ID and repeats it on the next load', async () => {
  const store = new Map(), first = browser({loading: true, store});
  assert.equal(first.timers.length, 0); assert.equal(first.calls.length, 0);
  first.ready(); assert.equal(first.calls.length, 0); await first.run();
  assert.equal(first.value.textContent, '1,234'); assert.equal(first.node.hidden, false);
  assert.equal(store.get(KEY), ID);
  const {url, options} = first.calls[0];
  assert.equal(url, '/api/visitors'); assert.equal(options.method, 'POST');
  assert.equal(options.credentials, 'omit'); assert.equal(options.referrerPolicy, 'no-referrer');
  assert.equal(options.cache, 'no-store'); assert.deepEqual(JSON.parse(options.body), {id: ID});
  assert(first.timers.find(timer => timer.delay === 6000).cleared);
  const next = browser({store, createId() { throw new Error('must reuse identity'); }});
  await next.run(); assert.equal(next.calls[0].options.body, options.body);
});

test('first visits in parallel tabs share a Web Lock and one persisted ID', async () => {
  let queue = Promise.resolve(), generated = 0;
  const locks = {request(key, fn) {
    assert.equal(key, KEY); const task = queue.then(fn); queue = task.catch(() => {}); return task;
  }};
  const options = {store: new Map(), locks, createId() { generated++; return randomUUID(); }};
  const tabs = Array.from({length: 8}, () => browser(options));
  await Promise.all(tabs.map(tab => tab.run()));
  assert.equal(generated, 1);
  assert.equal(new Set(tabs.map(tab => tab.calls[0].options.body)).size, 1);
});

test('unavailable or non-persisting storage only reads the total', async () => {
  for (const options of [{storageThrows: true}, {persist: false}]) {
    const page = browser(options); await page.run();
    assert.equal(page.calls[0].options.method, 'GET');
    assert.equal(page.calls[0].options.body, undefined); assert.equal(page.node.hidden, false);
  }
});

test('localhost and deployment previews neither fetch nor create an ID', async () => {
  for (const origin of ['http://localhost:8000', 'https://preview.wuwa-resonator.pages.dev', 'null']) {
    const page = browser({origin}); await page.run();
    assert.equal(page.calls.length, 0); assert.equal(page.reads(), 0); assert.equal(page.node.hidden, true);
  }
  const absent = browser({node: null}); await absent.run(); assert.equal(absent.calls.length, 0);
});

test('fetch failures and malformed totals stay hidden without leaking an error', async () => {
  for (const fetchImpl of [async () => { throw new Error('offline'); },
    async () => new Response('unavailable', {status: 503}), async () => new Response('not json'),
    ...[-1, 1.5, '12', null, Number.MAX_SAFE_INTEGER + 1].map(total => async () => Response.json({total}))]) {
    const page = browser({fetchImpl}); await page.run();
    assert.equal(page.node.hidden, true); assert.equal(page.value.textContent, '');
    assert(page.timers.find(timer => timer.delay === 6000).cleared);
  }
});

test('a stalled counter request aborts independently after its timeout', async () => {
  const page = browser({fetchImpl: (url, {signal}) => new Promise((resolve, reject) => {
    signal.addEventListener('abort', () => reject(new Error('aborted')), {once: true});
  })});
  const running = page.run();
  page.timers.find(timer => timer.delay === 6000).fn();
  await running;
  assert.equal(page.calls[0].options.signal.aborted, true); assert.equal(page.node.hidden, true);
});
