// Service Worker: кэшируем приложение целиком — офлайн-работа на iPad
const CACHE = 'yasya-v14';
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
  './games/abc/index.html',
  // Звуки букв (assets/abc/*.wav) сюда НЕ кладём: они догружаются при
  // первом открытии Азбуки (см. прогрев в games/abc) и кэшируются на лету.
  './assets/voice/manifest.js',
  ...VOICE_FILES,
];

self.addEventListener('install', (event) => {
  // Кэшируем по одному файлу, а не addAll: addAll атомарен, и один
  // сорвавшийся запрос из ~120 отменял всю пачку — установка SW падала
  // (в DevTools это выглядело как «отменённые mp3») и повторялась при
  // каждом заходе. Недостающее дотянется fetch-хэндлером при первом использовании.
  event.waitUntil(
    caches.open(CACHE).then((cache) =>
      Promise.allSettled(ASSETS.map((u) => cache.add(u)))
    )
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
