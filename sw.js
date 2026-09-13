// Offline-first. The app shell, the course and every unit's stroke bundle are
// precached at install, so a lesson and its writing track work on a plane
// before you have ever opened them. Bundles from the old HSK-band deck are
// cached the first time a character from it comes up.

const VERSION = 'hanzi-v8';
const SHELL = [
  './',
  'index.html',
  'app.css',
  'app.js',
  'js/store.js',
  'js/course.js',
  'js/exercises.js',
  'js/lesson.js',
  'js/audio.js',
  'js/writing.js',
  'manifest.webmanifest',
  'icon-180.png',
  'icon-192.png',
  'icon-512.png',
  'vendor/hanzi-writer.min.js',
  'vendor/ts-fsrs.mjs',
  'data/course.json',
  'data/curriculum.json',
];

// Which unit bundles exist is read off the course itself, so a rebuilt course
// that adds units needs only the VERSION bump above.
async function precache() {
  const cache = await caches.open(VERSION);
  await cache.addAll(SHELL);
  const course = await (await cache.match('data/course.json')).json();
  const bundles = course.units
    .filter((u) => u.ready && u.writing.length)
    .map((u) => `data/units/${u.id}.json`);
  await cache.addAll(bundles);
}

self.addEventListener('install', (e) => {
  e.waitUntil(precache().then(() => self.skipWaiting()));
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
  // The scanned textbook PDFs are large, token-gated and read online only, so
  // they go straight to the network and never enter the offline cache.
  if (new URL(e.request.url).pathname.includes('/textbooks/')) return;
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
