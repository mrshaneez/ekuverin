// api/admin.js — Ekuveri admin backend (Vercel Serverless Function)
// Storage: Vercel KV / Upstash Redis over REST. No npm dependencies.
//
// Public:
//   GET  /api/admin?get=public            -> { site, apps, docs }
// Auth:
//   POST /api/admin?action=login          body { email, password }      -> { token }
//   POST /api/admin?action=save           body { kind, data } + Bearer  -> { site, apps, docs }
//        kind = 'apps' | 'site' | 'docs'
//
// Required environment variables (set in Vercel → Settings → Environment Variables):
//   KV_REST_API_URL, KV_REST_API_TOKEN   (added automatically when you connect a Vercel KV store)
//   ADMIN_EMAIL          the admin's email
//   ADMIN_PASSWORD_HASH  salted scrypt hash, format "scrypt:<saltHex>:<hashHex>"
//   AUTH_SECRET          random string used to sign session tokens

import crypto from 'node:crypto';

const K = { apps: 'ekuveri:apps', site: 'ekuveri:site', docs: 'ekuveri:docs' };
const TOKEN_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

/* ---------- KV (Upstash REST) ---------- */
async function redis(command) {
  const url = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) return { error: 'store-not-configured' };
  const res = await fetch(url, {
    method: 'POST',
    headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' },
    body: JSON.stringify(command),
  });
  return res.json();
}
async function getJSON(key, fallback) {
  const out = await redis(['GET', key]);
  if (out && out.error) return null;
  try { return out && out.result ? JSON.parse(out.result) : fallback; }
  catch (e) { return fallback; }
}
async function setJSON(key, val) { await redis(['SET', key, JSON.stringify(val)]); }

/* ---------- auth ---------- */
function b64url(buf) { return Buffer.from(buf).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, ''); }
function hmac(data) { return crypto.createHmac('sha256', process.env.AUTH_SECRET || '').update(data).digest('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, ''); }
function sign(payload) { const body = b64url(JSON.stringify(payload)); return body + '.' + hmac(body); }
function verify(tok) {
  if (!tok || !process.env.AUTH_SECRET) return null;
  const i = tok.lastIndexOf('.');
  if (i < 0) return null;
  const body = tok.slice(0, i), sig = tok.slice(i + 1);
  const expect = hmac(body);
  if (sig.length !== expect.length) return null;
  if (!crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expect))) return null;
  let payload;
  try { payload = JSON.parse(Buffer.from(body.replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString()); }
  catch (e) { return null; }
  if (!payload.exp || Date.now() > payload.exp) return null;
  return payload;
}
function bearer(req) { return (req.headers.authorization || '').replace(/^Bearer\s+/i, '').trim(); }
function passwordOK(password) {
  const stored = process.env.ADMIN_PASSWORD_HASH || '';
  const parts = stored.split(':');
  if (parts.length !== 3 || parts[0] !== 'scrypt') return false;
  const salt = Buffer.from(parts[1], 'hex');
  const expected = Buffer.from(parts[2], 'hex');
  let got;
  try { got = crypto.scryptSync(String(password || ''), salt, expected.length); }
  catch (e) { return false; }
  return got.length === expected.length && crypto.timingSafeEqual(got, expected);
}

/* ---------- helpers ---------- */
function clean(v, n) { return String(v == null ? '' : v).slice(0, n); }
function host(u) { try { return new URL(u).hostname.replace(/^www\./, ''); } catch (e) { return ''; } }
function id() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 6); }
function safeJSON(s) { try { return JSON.parse(s); } catch (e) { return {}; } }

function sanitizeApps(arr) {
  if (!Array.isArray(arr)) return [];
  return arr.slice(0, 60).map((a) => ({
    id: a && a.id ? String(a.id).slice(0, 24) : id(),
    href: clean(a && a.href, 300).trim(),
    name: clean(a && a.name, 80),
    desc: clean(a && a.desc, 200),
    domain: clean((a && a.domain) || host((a && a.href) || ''), 120),
    status: (a && a.status) === 'soon' ? 'soon' : 'live',
  }));
}
function sanitizeDocs(arr) {
  if (!Array.isArray(arr)) return [];
  return arr.slice(0, 100).map((d) => ({
    id: d && d.id ? String(d.id).slice(0, 24) : id(),
    title: clean(d && d.title, 120),
    href: clean(d && d.href, 400).trim(),
  })).filter((d) => d.href || d.title);
}
function sanitizeSite(o) {
  o = o || {};
  const keys = ['heroSub', 'aboutTitle', 'aboutP1', 'aboutP2', 'email'];
  const out = {};
  keys.forEach((k) => { if (o[k] != null) out[k] = clean(o[k], 600); });
  return out;
}

/* ---------- handler ---------- */
export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.status(204).end();

  // status: which config the server can see (booleans only, no secrets revealed)
  if (req.method === 'GET' && req.query && req.query.get === 'status') {
    const has = (v) => !!(v && String(v).trim());
    return res.status(200).json({
      store: has(process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL) &&
             has(process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN),
      email: has(process.env.ADMIN_EMAIL),
      hash: has(process.env.ADMIN_PASSWORD_HASH),
      secret: has(process.env.AUTH_SECRET),
    });
  }

  // public read
  if (req.method === 'GET') {
    const site = await getJSON(K.site, {});
    if (site === null) return res.status(503).json({ error: 'store not configured' });
    const apps = (await getJSON(K.apps, [])) || [];
    const docs = (await getJSON(K.docs, [])) || [];
    return res.status(200).json({ site, apps, docs });
  }

  if (req.method === 'POST') {
    const action = req.query && req.query.action;
    const body = typeof req.body === 'string' ? safeJSON(req.body) : (req.body || {});

    if (action === 'login') {
      const email = clean(body.email, 200).trim().toLowerCase();
      const adminEmail = (process.env.ADMIN_EMAIL || '').trim().toLowerCase();
      if (!adminEmail || !process.env.ADMIN_PASSWORD_HASH || !process.env.AUTH_SECRET) {
        return res.status(503).json({ error: 'auth not configured' });
      }
      if (email !== adminEmail || !passwordOK(body.password)) {
        return res.status(401).json({ error: 'unauthorized' });
      }
      const token = sign({ sub: adminEmail, exp: Date.now() + TOKEN_TTL_MS });
      return res.status(200).json({ token });
    }

    if (action === 'save') {
      if (!verify(bearer(req))) return res.status(401).json({ error: 'unauthorized' });
      const kind = body.kind;
      if (kind === 'apps') await setJSON(K.apps, sanitizeApps(body.data));
      else if (kind === 'docs') await setJSON(K.docs, sanitizeDocs(body.data));
      else if (kind === 'site') await setJSON(K.site, sanitizeSite(body.data));
      else return res.status(400).json({ error: 'unknown kind' });

      const site = (await getJSON(K.site, {})) || {};
      const apps = (await getJSON(K.apps, [])) || [];
      const docs = (await getJSON(K.docs, [])) || [];
      return res.status(200).json({ site, apps, docs });
    }

    return res.status(400).json({ error: 'unknown action' });
  }

  res.setHeader('Allow', 'GET,POST,OPTIONS');
  return res.status(405).json({ error: 'method not allowed' });
}
