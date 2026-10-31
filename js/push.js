/* Shift reminders over Web Push. Off until js/config.js names a server.
 * The phone keeps only a random device token and an on/off flag. */
'use strict';

const PUSH_TOKEN_KEY = 'cnc.push.token';
const PUSH_ON_KEY = 'cnc.push.on';

const pushConfig = () => (window.CNC_PUSH && window.CNC_PUSH.server ? window.CNC_PUSH : null);

function pushAvailable() {
  return !!(pushConfig() && 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window);
}

function pushOn() {
  try { return localStorage.getItem(PUSH_ON_KEY) === '1'; } catch (_) { return false; }
}

function deviceToken() {
  let t = null;
  try { t = localStorage.getItem(PUSH_TOKEN_KEY); } catch (_) { /* private window */ }
  if (!t) {
    const bytes = crypto.getRandomValues(new Uint8Array(24));
    t = Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
    try { localStorage.setItem(PUSH_TOKEN_KEY, t); } catch (_) { /* keep it for this session */ }
  }
  return t;
}

function keyBytes(b64) {
  const pad = '='.repeat((4 - (b64.length % 4)) % 4);
  const raw = atob((b64 + pad).replace(/-/g, '+').replace(/_/g, '/'));
  return Uint8Array.from(raw, (c) => c.charCodeAt(0));
}

async function reminderApi(method, route, body) {
  const res = await fetch(pushConfig().server.replace(/\/$/, '') + route, {
    method,
    headers: { 'Content-Type': 'application/json', 'X-Device-Token': deviceToken() },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) throw new Error(route + ' ' + res.status);
  return res.status === 204 ? null : res.json();
}

/* Must run from a tap: iOS only shows the permission prompt in response to a gesture. */
async function enablePush() {
  if (!pushAvailable()) throw new Error('reminders not set up');
  const perm = await Notification.requestPermission();
  if (perm !== 'granted') return false;
  const reg = await navigator.serviceWorker.ready;
  let sub = await reg.pushManager.getSubscription();
  if (!sub) {
    sub = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: keyBytes(pushConfig().vapidPublicKey),
    });
  }
  await reminderApi('POST', '/api/subscribe', { subscription: sub.toJSON() });
  localStorage.setItem(PUSH_ON_KEY, '1');
  return true;
}

async function disablePush() {
  localStorage.removeItem(PUSH_ON_KEY);
  try { await reminderApi('DELETE', '/api/subscribe'); } catch (_) { /* server may be down; it forgets us on the next failed push */ }
  if (!('serviceWorker' in navigator)) return;
  const reg = await navigator.serviceWorker.ready;
  const sub = await reg.pushManager.getSubscription();
  if (sub) await sub.unsubscribe();
}

/* Replaces tonight's reminders on the server. A failure here never affects the
 * checklist itself; the next change to the shift tries again. */
async function syncReminders(items) {
  if (!pushAvailable() || !pushOn()) return;
  try { await reminderApi('POST', '/api/schedule', { items }); } catch (_) { /* retried on the next change */ }
}
