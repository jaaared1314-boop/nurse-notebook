/* Offline shell. Bump CACHE whenever a file below changes so phones that
 * already installed the app pick up the new version on their next launch. */

const CACHE = 'cnc-v13';
const ASSETS = [
  './',
  './index.html',
  './css/styles.css',
  './js/template.js',
  './js/app.js',
  './js/config.js',
  './js/push.js',
  './manifest.webmanifest',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/apple-touch-icon.png',
];

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE).then((c) => c.addAll(ASSETS)).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== self.location.origin) return;

  // Navigations: try the network so a deployed update lands promptly, but fall
  // back to the cached shell the moment the phone is offline or on hospital wifi
  // that resolves but never answers.
  if (req.mode === 'navigate') {
    e.respondWith(
      fetch(req)
        .then((res) => {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put('./index.html', copy));
          return res;
        })
        .catch(() => caches.match('./index.html'))
    );
    return;
  }

  e.respondWith(
    caches.match(req).then((hit) =>
      hit ||
      fetch(req).then((res) => {
        const copy = res.clone();
        caches.open(CACHE).then((c) => c.put(req, copy));
        return res;
      })
    )
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
