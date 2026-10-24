const ORIGINS = new Set(['https://wuwa.south-wall.com', 'https://wuwa-lightstick.pages.dev']);
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const MAX_BODY = 256;
const SELECT_TOTAL = 'SELECT total FROM visitor_totals WHERE id = 1';

function reply(status, data, extra = {}) {
  return new Response(JSON.stringify(data), {status, headers: {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
    'CDN-Cache-Control': 'no-store',
    'X-Content-Type-Options': 'nosniff',
    ...extra
  }});
}

class InputError extends Error {
  constructor(status, message) { super(message); this.status = status; }
}

async function readId(request) {
  const length = request.headers.get('Content-Length');
  if (length !== null && !/^\d+$/.test(length)) throw new InputError(400, 'invalid_body');
  if (length !== null && Number(length) > MAX_BODY) throw new InputError(413, 'body_too_large');
  if (!request.body) throw new InputError(400, 'invalid_body');
  // Bound the stream too: Content-Length can be absent or misleading.
  const reader = request.body.getReader(), bytes = new Uint8Array(MAX_BODY);
  let used = 0;
  try {
    for (;;) {
      const {done, value} = await reader.read();
      if (done) break;
      if (used + value.byteLength > MAX_BODY) {
        await reader.cancel();
        throw new InputError(413, 'body_too_large');
      }
      bytes.set(value, used); used += value.byteLength;
    }
  } finally { reader.releaseLock(); }
  let body;
  try { body = JSON.parse(new TextDecoder('utf-8', {fatal: true}).decode(bytes.subarray(0, used))); }
  catch { throw new InputError(400, 'invalid_body'); }
  if (!body || typeof body !== 'object' || Array.isArray(body) ||
      Object.keys(body).length !== 1 || typeof body.id !== 'string' || !UUID.test(body.id)) {
    throw new InputError(400, 'invalid_id');
  }
  return body.id.toLowerCase();
}

export async function onRequest({request, env}) {
  const origin = new URL(request.url).origin;
  if (!ORIGINS.has(origin)) return reply(404, {error: 'not_found'});
  if (!['GET', 'POST'].includes(request.method)) {
    return reply(405, {error: 'method_not_allowed'}, {Allow: 'GET, POST'});
  }
  if (request.method === 'POST') {
    if (request.headers.get('Origin') !== origin) return reply(403, {error: 'origin_not_allowed'});
    if (request.headers.get('Content-Type')?.split(';')[0].trim().toLowerCase() !== 'application/json') {
      return reply(415, {error: 'json_required'});
    }
  }
  try {
    let total;
    const db = env?.VISITORS_DB;
    if (request.method === 'GET') {
      total = await db.prepare(SELECT_TOTAL).first('total');
    } else {
      const id = await readId(request);
      const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(id));
      const hash = Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, '0')).join('');
      // The unique insert and its trigger are atomic; the batch also reads that transaction's total.
      const result = await db.batch([
        db.prepare('INSERT INTO visitor_ids (id_hash) VALUES (?) ON CONFLICT(id_hash) DO NOTHING').bind(hash),
        db.prepare(SELECT_TOTAL)
      ]);
      if (result.some(item => !item.success)) throw new Error('Database unavailable');
      total = result[1]?.results?.[0]?.total;
    }
    if (!Number.isSafeInteger(total) || total < 0) throw new Error('Invalid total');
    return reply(200, {total});
  } catch (error) {
    return error instanceof InputError
      ? reply(error.status, {error: error.message})
      : reply(503, {error: 'unavailable'});
  }
}
