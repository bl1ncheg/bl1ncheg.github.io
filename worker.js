const STATUSES = ['new', 'in_work', 'done'];
const RATE_LIMIT = 5;            // заявок с одного адреса
const RATE_WINDOW_MIN = 10;      // за столько минут

function clean(v, max) {
  return String(v == null ? '' : v).replace(/\u0000/g, '').trim().slice(0, max);
}
function esc(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
function numberOf(id) {
  return 'HEV-' + String(id).padStart(4, '0');
}
function json(data, status, headers) {
  return new Response(JSON.stringify(data), {
    status: status || 200,
    headers: Object.assign({ 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' }, headers || {})
  });
}
async function sha256hex(str) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(str));
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, '0')).join('');
}
function equalBytes(a, b) {
  const x = new Uint8Array(a), y = new Uint8Array(b);
  if (x.length !== y.length) return false;
  let diff = 0;
  for (let i = 0; i < x.length; i++) diff |= x[i] ^ y[i];
  return diff === 0;
}
async function isAdmin(request, env) {
  const header = request.headers.get('Authorization') || '';
  const given = header.startsWith('Bearer ') ? header.slice(7) : '';
  if (!env.ADMIN_TOKEN || !given) return false;
  const enc = new TextEncoder();
  const a = await crypto.subtle.digest('SHA-256', enc.encode(given));
  const b = await crypto.subtle.digest('SHA-256', enc.encode(env.ADMIN_TOKEN));
  return typeof crypto.subtle.timingSafeEqual === 'function' ? crypto.subtle.timingSafeEqual(a, b) : equalBytes(a, b);
}

async function notifyTelegram(env, number, r) {
  if (!env.TELEGRAM_BOT_TOKEN || !env.TELEGRAM_CHAT_ID) return;
  const text =
    '🆕 <b>Заявка ' + number + '</b>\n' +
    '<b>Имя:</b> ' + esc(r.name) + '\n' +
    '<b>Связь:</b> ' + esc(r.contact) + '\n' +
    '<b>Услуга:</b> ' + esc(r.service || 'не указана') + '\n\n' +
    esc(r.message);
  try {
    await fetch('https://api.telegram.org/bot' + env.TELEGRAM_BOT_TOKEN + '/sendMessage', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: env.TELEGRAM_CHAT_ID, text: text, parse_mode: 'HTML', disable_web_page_preview: true })
    });
  } catch (e) { /* заявка уже сохранена, сбой Telegram её не отменяет */ }
}

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const origin = request.headers.get('Origin') || '';
    const allowed = String(env.ALLOWED_ORIGIN || '').split(',').map((s) => s.trim()).filter(Boolean);
    const originOk = allowed.indexOf(origin) !== -1;
    const cors = originOk ? { 'Access-Control-Allow-Origin': origin, 'Vary': 'Origin' } : { 'Vary': 'Origin' };

    if (request.method === 'OPTIONS') {
      return new Response(null, {
        status: originOk ? 204 : 403,
        headers: Object.assign({
          'Access-Control-Allow-Methods': 'GET, POST, PATCH, DELETE, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type, Authorization',
          'Access-Control-Max-Age': '86400'
        }, cors)
      });
    }

    const m = url.pathname.match(/^\/requests(?:\/(\d+))?\/?$/);
    if (!m) return json({ error: 'not_found' }, 404, cors);
    const id = m[1] ? parseInt(m[1], 10) : null;

    /* Публичная отправка заявки */
    if (request.method === 'POST' && id === null) {
      if (!originOk) return json({ error: 'forbidden' }, 403, cors);
      let body;
      try { body = await request.json(); } catch (e) { return json({ error: 'bad_json' }, 400, cors); }
      if (!body || typeof body !== 'object') return json({ error: 'bad_json' }, 400, cors);
      if (clean(body.website, 200)) return json({ ok: true, number: numberOf(0) }, 201, cors); // ловушка для ботов

      const r = {
        name: clean(body.name, 80),
        contact: clean(body.contact, 120),
        service: clean(body.service, 60),
        message: clean(body.message, 2000)
      };
      if (!r.name || !r.contact || !r.message) return json({ error: 'missing_fields' }, 400, cors);

      const ip = request.headers.get('CF-Connecting-IP') || 'unknown';
      const ipHash = await sha256hex((env.IP_SALT || 'salt') + ip);
      const since = new Date(Date.now() - RATE_WINDOW_MIN * 60 * 1000).toISOString();
      const rate = await env.DB.prepare('SELECT COUNT(*) AS n FROM requests WHERE ip_hash = ? AND created_at > ?').bind(ipHash, since).first();
      if (rate && rate.n >= RATE_LIMIT) return json({ error: 'rate_limited' }, 429, cors);

      const created = new Date().toISOString();
      const res = await env.DB.prepare(
        'INSERT INTO requests (created_at, name, contact, service, message, status, ip_hash) VALUES (?, ?, ?, ?, ?, ?, ?)'
      ).bind(created, r.name, r.contact, r.service, r.message, 'new', ipHash).run();
      const number = numberOf(res.meta.last_row_id);
      ctx.waitUntil(notifyTelegram(env, number, r));
      return json({ ok: true, number: number }, 201, cors);
    }

    /* Дальше только для администратора */
    if (!(await isAdmin(request, env))) return json({ error: 'unauthorized' }, 401, cors);

    if (request.method === 'GET' && id === null) {
      const rows = await env.DB.prepare(
        'SELECT id, created_at, name, contact, service, message, status FROM requests ORDER BY id DESC LIMIT 200'
      ).all();
      const list = (rows.results || []).map((x) => Object.assign({ number: numberOf(x.id) }, x));
      return json({ requests: list }, 200, cors);
    }

    if (request.method === 'PATCH' && id !== null) {
      let body;
      try { body = await request.json(); } catch (e) { return json({ error: 'bad_json' }, 400, cors); }
      if (!body || STATUSES.indexOf(body.status) === -1) return json({ error: 'bad_status' }, 400, cors);
      await env.DB.prepare('UPDATE requests SET status = ? WHERE id = ?').bind(body.status, id).run();
      return json({ ok: true }, 200, cors);
    }

    if (request.method === 'DELETE' && id !== null) {
      await env.DB.prepare('DELETE FROM requests WHERE id = ?').bind(id).run();
      return json({ ok: true }, 200, cors);
    }

    return json({ error: 'method_not_allowed' }, 405, cors);
  }
};