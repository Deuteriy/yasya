// Service Worker: кэшируем приложение целиком — офлайн-работа на iPad
const CACHE = 'yasya-v1';
// Пути относительные: приложение живёт в подкаталоге на GitHub Pages
// (username.github.io/Yasya/), абсолютные "/..." ломались бы.
const ASSETS = [
  './',
  './index.html',
  './css/style.css',
  './js/core.js',
  './js/hub.js',
  './manifest.json',
  './assets/icons/icon-180.png',
  './assets/icons/icon-192.png',
  './assets/icons/icon-512.png',
  './games/colors/index.html',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE).then((cache) => cache.addAll(ASSETS))
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

// Кэш-первый: на iPad сеть может пропадать, приложение должно всегда открываться
self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;
  event.respondWith(
    caches.match(event.request).then((cached) => {
      return (
        cached ||
        fetch(event.request).then((response) => {
          // новые ресурсы (страницы будущих игр) кладём в кэш на лету
          if (response.ok && new URL(event.request.url).origin === location.origin) {
            const copy = response.clone();
            caches.open(CACHE).then((cache) => cache.put(event.request, copy));
          }
          return response;
        })
      );
    })
  );
});
