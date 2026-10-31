'use strict';

/* Reminder server for the Charge Nurse Checklist.
 *
 * For each phone it keeps one Web Push subscription and that phone's timed
 * checks for tonight. It sends a notification PRE_MINUTES before each check
 * and another when it is due. Checks are dropped a couple of hours after they
 * are due. Nothing else is stored: no notes, no shift history, no names.
 */

const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const webpush = require('web-push');

const PORT = Number(process.env.PORT) || 8787;
const DATA_FILE = process.env.DATA_FILE || path.join(__dirname, 'data', 'store.json');
const ALLOWED_ORIGIN = process.env.ALLOWED_ORIGIN || '*';
const PRE_MINUTES = 15;
const DUE_WINDOW_MS = 30 * 60 * 1000;      // a "due now" alert is only sent this soon after the time
const KEEP_AFTER_MS = 2 * 60 * 60 * 1000;  // a check is forgotten this long after it is due
const TICK_MS = 30 * 1000;
const MAX_BODY = 64 * 1024;

const sha = (s) => crypto.createHash('sha256').update(s).digest('hex');

let store = {};   // sha256(deviceToken) -> { subscription, items: [...] }

function load() {
  try {
    store = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
  } catch (_) {
    store = {};
  }
}

function save() {
  fs.mkdirSync(path.dirname(DATA_FILE), { recursive: true });
  fs.writeFileSync(DATA_FILE, JSON.stringify(store));
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks = [];
    req.on('data', (c) => {
      size += c.length;
      if (size > MAX_BODY) {
        reject(Object.assign(new Error('too large'), { status: 413 }));
        req.destroy();
      } else {
        chunks.push(c);
      }
    });
    req.on('end', () => {
      try {
        resolve(JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}'));
      } catch (e) {
        reject(Object.assign(new Error('bad json'), { status: 400 }));
      }
    });
    req.on('error', reject);
  });
}

function send(res, status, obj) {
  res.writeHead(status, {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': ALLOWED_ORIGIN,
    'Access-Control-Allow-Headers': 'Content-Type, X-Device-Token',
    'Access-Control-Allow-Methods': 'POST, DELETE, OPTIONS',
  });
  res.end(obj === undefined ? '' : JSON.stringify(obj));
}

/* Checks the shape of a schedule sent by a phone. Returns null if anything is wrong. */
function cleanItems(items) {
  if (!Array.isArray(items) || items.length > 200) return null;
  const out = [];
  for (const it of items) {
    const due = it && typeof it.id === 'string' ? Date.parse(it.dueAt) : NaN;
    if (!it || typeof it.id !== 'string' || it.id.length > 120 || Number.isNaN(due)) return null;
    out.push({
      id: it.id,
      dueAt: due,
      room: String(it.room || '').slice(0, 40),
      label: String(it.label || 'Check').slice(0, 60),
      preSent: false,
      dueSent: false,
    });
  }
  return out;
}

async function handle(req, res) {
  if (req.method === 'OPTIONS') return send(res, 204);
  if (req.url === '/api/health') return send(res, 200, { ok: true });

  const token = req.headers['x-device-token'];
  if (typeof token !== 'string' || token.length < 20 || token.length > 100) {
    return send(res, 401, { error: 'missing device token' });
  }
  const key = sha(token);

  if (req.url === '/api/subscribe' && req.method === 'POST') {
    const { subscription } = await readBody(req);
    if (!subscription || typeof subscription.endpoint !== 'string' || !subscription.keys) {
      return send(res, 400, { error: 'bad subscription' });
    }
    store[key] = { subscription, items: (store[key] && store[key].items) || [] };
    save();
    return send(res, 200, { ok: true });
  }

  if (req.url === '/api/subscribe' && req.method === 'DELETE') {
    delete store[key];
    save();
    return send(res, 200, { ok: true });
  }

  if (req.url === '/api/schedule' && req.method === 'POST') {
    const rec = store[key];
    if (!rec) return send(res, 404, { error: 'not subscribed' });
    const items = cleanItems((await readBody(req)).items);
    if (!items) return send(res, 400, { error: 'bad items' });
    // Keep "already sent" flags for checks that have not moved, so a re-sync never repeats an alert.
    const before = new Map(rec.items.map((i) => [i.id, i]));
    items.forEach((i) => {
      const o = before.get(i.id);
      if (o && o.dueAt === i.dueAt) {
        i.preSent = o.preSent;
        i.dueSent = o.dueSent;
      }
    });
    rec.items = items;
    save();
    return send(res, 200, { ok: true, count: items.length });
  }

  return send(res, 404, { error: 'not found' });
}

/* Sends whatever is due. `sender` is injectable so the tests can watch what would go out. */
async function tick(now = Date.now(), sender = webpush.sendNotification) {
  let changed = false;
  for (const key of Object.keys(store)) {
    const rec = store[key];
    rec.items = rec.items.filter((i) => now < i.dueAt + KEEP_AFTER_MS);
    for (const i of rec.items) {
      const pre = !i.preSent && now >= i.dueAt - PRE_MINUTES * 60000 && now < i.dueAt;
      const due = !i.dueSent && now >= i.dueAt && now < i.dueAt + DUE_WINDOW_MS;
      if (!pre && !due) continue;
      const payload = pre
        ? { title: `${i.label} due in ${PRE_MINUTES} min`, body: i.room, tag: i.id + ':pre' }
        : { title: `${i.label} due now`, body: i.room, tag: i.id + ':due' };
      try {
        await sender(rec.subscription, JSON.stringify(payload), { TTL: 900 });
        if (pre) i.preSent = true;
        else i.dueSent = true;
        changed = true;
      } catch (e) {
        // 404 or 410 means the phone unsubscribed or the app was removed. Forget it.
        if (e.statusCode === 404 || e.statusCode === 410) {
          delete store[key];
          changed = true;
          break;
        }
        // Anything else: leave the flag unset so the next tick tries again.
      }
    }
  }
  if (changed) save();
}

function createServer() {
  return http.createServer(async (req, res) => {
    try {
      await handle(req, res);
    } catch (e) {
      send(res, e.status || 500, { error: e.status ? e.message : 'server error' });
    }
  });
}

if (require.main === module) {
  const pub = process.env.VAPID_PUBLIC;
  const priv = process.env.VAPID_PRIVATE;
  if (!pub || !priv) {
    console.error('Set VAPID_PUBLIC and VAPID_PRIVATE first. See server/README.md.');
    process.exit(1);
  }
  webpush.setVapidDetails(process.env.VAPID_SUBJECT || 'mailto:admin@example.com', pub, priv);
  load();
  createServer().listen(PORT, () => console.log('reminder server listening on', PORT));
  setInterval(() => tick().catch((e) => console.error('tick failed:', e.message)), TICK_MS);
}

module.exports = {
  createServer,
  tick,
  store: () => store,
  setStore: (s) => { store = s; },
  load,
  sha,
};
