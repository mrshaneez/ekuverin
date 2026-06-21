// api/apps.js — Ekuveri shared app list (Vercel Serverless Function)
// Storage: Vercel KV / Upstash Redis over REST. No npm dependencies.
// GET    -> public: returns { apps: [...] }
// POST   -> requires Authorization: Bearer <ADMIN_TOKEN>; adds one app
// DELETE -> requires the same token; removes by ?id=<id>
//
// Required environment variables (set in Vercel → Project → Settings → Environment Variables):
//   KV_REST_API_URL     (provided automatically when you connect a Vercel KV / Upstash store)
//   KV_REST_API_TOKEN   (provided automatically with the store)
//   ADMIN_TOKEN         (a secret you choose — this is what unlocks "manage" on the site)

const KEY = 'ekuveri:apps';

async function redis(command) {
  const url = process.env.KV_REST_API_URL;
  const token = process.env.KV_REST_API_TOKEN;
  if (!url || !token) return { error: 'store-not-configured' };
  const res = await fetch(url, {
    method: 'POST',
    headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' },
    body: JSON.stringify(command),
  });
  return res.json();
}

async function getApps() {
  const out = await redis(['GET', KEY]);
  if (out && out.error) return null;            // store not configured
  try { return out && out.result ? JSON.parse(out.result) : []; }
  catch (e) { return []; }
}
async function setApps(apps) { await redis(['SET', KEY, JSON.stringify(apps)]); }

function authed(req) {
  const h = req.headers.authorization || '';
  const t = h.replace(/^Bearer\s+/i, '').trim();
  return !!process.env.ADMIN_TOKEN && t === process.env.ADMIN_TOKEN;
}
function clean(v, n) { return String(v == null ? '' : v).slice(0, n); }
function safeJSON(s) { try { return JSON.parse(s); } catch (e) { return {}; } }

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,DELETE,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.status(204).end();

  let apps = await getApps();
  if (apps === null) return res.status(503).json({ error: 'store not configured' });

  if (req.method === 'GET') {
    return res.status(200).json({ apps });
  }

  if (req.method === 'POST') {
    if (!authed(req)) return res.status(401).json({ error: 'unauthorized' });
    const b = typeof req.body === 'string' ? safeJSON(req.body) : (req.body || {});
    const href = clean(b.href, 300).trim();
    if (!href) return res.status(400).json({ error: 'href required' });
    apps.push({
      id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
      href,
      name: clean(b.name, 80),
      desc: clean(b.desc, 200),
      domain: clean(b.domain, 120),
    });
    await setApps(apps);
    return res.status(200).json({ apps });
  }

  if (req.method === 'DELETE') {
    if (!authed(req)) return res.status(401).json({ error: 'unauthorized' });
    const id = (req.query && req.query.id) || (req.body && req.body.id);
    if (!id) return res.status(400).json({ error: 'id required' });
    apps = apps.filter((a) => a.id !== id);
    await setApps(apps);
    return res.status(200).json({ apps });
  }

  res.setHeader('Allow', 'GET,POST,DELETE,OPTIONS');
  return res.status(405).json({ error: 'method not allowed' });
}
