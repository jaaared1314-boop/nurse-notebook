/* Offline shell. Bump CACHE whenever a file below changes so phones that
 * already installed the app pick up the new version on their next launch. */

const CACHE = 'cnc-v24';
const ASSETS = [
  './',
  './index.html',
  './css/styles.css',
  './js/template.js',
  './js/app.js',
  './js/config.js',
  './js/push.js',
  './js/views.js',
  './manifest.webmanifest',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/apple-touch-icon.png',
];

self.addEventListener('install', (e) => {
  e.waitUntil(
    // 'reload' skips the browser's own web cache, so the saved copy is the deployed one
    caches.open(CACHE)
      .then((c) => c.addAll(ASSETS.map((u) => new Request(u, { cache: 'reload' }))))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

/* Network first for everything the app ships, so a deployed update shows up on
 * the next open instead of waiting for the phone to drop its saved copy. The
 * saved copy is the fallback when the phone is offline, or on hospital wifi
 * that connects but never answers (the 4-second timeout). */
const NET_TIMEOUT_MS = 4000;

function fromNetwork(req) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('timeout')), NET_TIMEOUT_MS);
    // 'no-cache' asks the server whether the file changed (a cheap check), instead
    // of trusting the browser's web cache, which GitHub lets keep files for 10 minutes.
    fetch(req.url, { cache: 'no-cache', credentials: 'same-origin' })
      .then((res) => { clearTimeout(timer); resolve(res); }, (err) => { clearTimeout(timer); reject(err); });
  });
}

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== self.location.origin) return;
  const key = req.mode === 'navigate' ? './index.html' : req;

  e.respondWith(
    fromNetwork(req)
      .then((res) => {
        if (res.ok) {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(key, copy));
        }
        return res;
      })
      .catch(() => caches.match(key, { ignoreSearch: true }).then((hit) => hit || Response.error()))
  );
});

/* Reminder notifications. iOS requires each push to show a notification. */
self.addEventListener('push', (e) => {
  let data = {};
  try { data = e.data ? e.data.json() : {}; } catch (_) { /* fall through to the defaults */ }
  e.waitUntil(self.registration.showNotification(data.title || 'Charge Nurse Checklist', {
    body: data.body || '',
    tag: data.tag,
    icon: './icons/icon-192.png',
    badge: './icons/icon-192.png',
    data: { url: './index.html' },
  }));
});

self.addEventListener('notificationclick', (e) => {
  e.notification.close();
  e.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((list) => {
      if (list.length) return list[0].focus();
      return self.clients.openWindow(e.notification.data.url || './index.html');
    })
  );
});
