// Service worker: l'app funziona anche offline.
// Cambia VERSION quando pubblichi una nuova versione dei file.
const VERSION = 'lotteria-v5';
const SHELL = ['./', './index.html', './manifest.webmanifest', './css/app.css',
  './js/app.js', './js/config.js', './js/util.js', './js/crypto.js', './js/domain.js', './js/icons.js',
  './js/state.js', './js/views.js', './js/store-local.js', './js/store-firebase.js',
  './icons/icon.svg', './icons/icon-192.png', './icons/icon-512.png'];
const FIREBASE_SDK = 'https://www.gstatic.com/firebasejs/';

self.addEventListener('install', e => {
  e.waitUntil(caches.open(VERSION).then(c => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== VERSION).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  // SDK Firebase (file con versione nel percorso, non cambiano mai): prima la cache, così l'app parte anche offline.
  if (req.url.startsWith(FIREBASE_SDK)) {
    e.respondWith(caches.match(req).then(hit => hit || fetch(req).then(res => {
      if (res.ok) { const copy = res.clone(); caches.open(VERSION).then(c => c.put(req, copy)); }
      return res;
    })));
    return;
  }
  if (url.origin !== location.origin) return; // database e login Firebase: sempre dalla rete
  // File dell'app: prima la rete (per avere gli aggiornamenti), poi la cache se offline.
  e.respondWith(fetch(req).then(res => {
    if (res.ok) { const copy = res.clone(); caches.open(VERSION).then(c => c.put(req.mode === 'navigate' ? './index.html' : req, copy)); }
    return res;
  }).catch(() => caches.match(req.mode === 'navigate' ? './index.html' : req)));
});
