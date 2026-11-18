// Service Worker: кэшируем приложение целиком — офлайн-работа на iPad
const CACHE = 'yasya-v10';
// список озвучек (assets/voice/*.mp3) — генерируется voicegen/batch_yasya.py
importScripts('./assets/voice/manifest.js');
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
  './assets/fonts/nunito-cyrillic.woff2',
  './assets/fonts/nunito-latin.woff2',
  './assets/sounds/cow.wav',
  './assets/sounds/dog.wav',
  './assets/sounds/cat.wav',
  './assets/sounds/sheep.wav',
  './assets/sounds/pig.wav',
  './assets/sounds/horse.wav',
  './assets/sounds/rooster.wav',
  './assets/sounds/chicken.wav',
  './assets/sounds/goat.wav',
  './assets/sounds/bee.wav',
  './assets/sounds/wolf.wav',
  './assets/sounds/lion.wav',
  './assets/sounds/monkey.wav',
  './assets/sounds/bat.wav',
  './assets/sounds/bird.wav',
  './assets/sounds/snake.wav',
  './games/colors/index.html',
  './games/memory/index.html',
  './games/count/index.html',
  './games/sounds/index.html',
  './games/shadows/index.html',
  './games/paint/index.html',
  './games/puzzle/index.html',
  './games/bubbles/index.html',
  './games/simon/index.html',
  './games/baskets/index.html',
  './games/size/index.html',
  './games/whosaid/index.html',
  './games/odd/index.html',
  './games/pattern/index.html',
  './games/maze/index.html',
  './games/piano/index.html',
  './assets/voice/manifest.js',
  ...VOICE_FILES,
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
