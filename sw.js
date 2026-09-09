// Offline-first. The app shell and curriculum are precached; stroke bundles
// are cached the first time a unit is reached, so the deck keeps working on
// a plane once you have been through it.

const VERSION = 'hanzi-v5';
const SHELL = [
  './',
  'index.html',
  'app.css',
  'app.js',
  'js/store.js',
  'js/course.js',
  'js/exercises.js',
  'js/lesson.js',
  'js/writing.js',
  'manifest.webmanifest',
  'icon-180.png',
  'icon-192.png',
  'icon-512.png',
  'vendor/hanzi-writer.min.js',
  'vendor/ts-fsrs.mjs',
  'data/course.json',
  'data/curriculum.json',
  'data/units/b1l1.json',
  'data/strokes/unit-01.json',
  'data/strokes/unit-02.json',
];

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(VERSION).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== VERSION).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET') return;
  e.respondWith(
    caches.match(e.request).then(
      (hit) =>
        hit ||
        fetch(e.request).then((res) => {
          if (res.ok && new URL(e.request.url).origin === location.origin) {
            const copy = res.clone();
            caches.open(VERSION).then((c) => c.put(e.request, copy));
          }
          return res;
        })
    )
  );
});
