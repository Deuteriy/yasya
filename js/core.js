// ===== Общее ядро для всех игр =====

// ===== Настройки =====
const Settings = {
  soundOn() {
    try {
      return localStorage.getItem('yasya.settings.sound') !== 'off';
    } catch {
      return true;
    }
  },
  setSound(on) {
    try {
      localStorage.setItem('yasya.settings.sound', on ? 'on' : 'off');
    } catch {}
  },
  voiceURI() {
    try {
      return localStorage.getItem('yasya.settings.voice') || '';
    } catch {
      return '';
    }
  },
  setVoice(uri) {
    try {
      localStorage.setItem('yasya.settings.voice', uri);
    } catch {}
  },
};

// iOS блокирует звук до первого пользовательского касания.
// AudioContext создаём лениво и возобновляем на первом тапе.
let _audioCtx = null;

function getAudioCtx() {
  if (!_audioCtx) {
    _audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  }
  if (_audioCtx.state === 'suspended') {
    _audioCtx.resume();
  }
  return _audioCtx;
}

// Однократная разблокировка звука на всей странице
(function unlockAudioOnFirstTouch() {
  const unlock = () => {
    getAudioCtx();
    window.removeEventListener('touchstart', unlock);
    window.removeEventListener('pointerdown', unlock);
    window.removeEventListener('mousedown', unlock);
  };
  window.addEventListener('touchstart', unlock, { passive: true });
  window.addEventListener('pointerdown', unlock, { passive: true });
  window.addEventListener('mousedown', unlock);
})();

// iOS: контекст может «засыпать» (например, после синтеза речи, который
// перехватывает аудиосессию) — перед каждым звуком убеждаемся, что он запущен.
async function ensureAudio() {
  const ctx = getAudioCtx();
  if (ctx.state !== 'running') {
    try {
      await ctx.resume();
    } catch {}
  }
  return ctx;
}

// Простой тон-звук без внешних файлов: kind 'pop' | 'success' | 'fail'
async function playSound(kind = 'pop') {
  if (!Settings.soundOn()) return;
  try {
    const ctx = await ensureAudio();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);

    const now = ctx.currentTime;
    if (kind === 'success') {
      // бодрая восходящая фраза C5-E5-G5
      const notes = [523.25, 659.25, 783.99];
      notes.forEach((freq, i) => {
        const t = now + i * 0.12;
        osc.frequency.setValueAtTime(freq, t);
        gain.gain.setValueAtTime(0.22, t);
        gain.gain.exponentialRampToValueAtTime(0.001, t + 0.3);
      });
      osc.start(now);
      osc.stop(now + notes.length * 0.12 + 0.35);
    } else if (kind === 'fail') {
      osc.type = 'sine';
      osc.frequency.setValueAtTime(300, now);
      osc.frequency.exponentialRampToValueAtTime(150, now + 0.25);
      gain.gain.setValueAtTime(0.2, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.3);
      osc.start(now);
      osc.stop(now + 0.3);
    } else {
      // 'pop' — короткий щелчок на нажатие
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(600, now);
      osc.frequency.exponentialRampToValueAtTime(900, now + 0.08);
      gain.gain.setValueAtTime(0.3, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.12);
      osc.start(now);
      osc.stop(now + 0.12);
    }
  } catch (e) {
    // звук — не критичен, игра должна работать и без него
    console.warn('audio:', e);
  }
}

// ===== Речь: сперва записанный голос родителя, потом синтез =====
// Записи живут в IndexedDB (ключ — фраза, значение — Blob).

let _voiceDB = null;
function getVoiceDB() {
  return new Promise((resolve, reject) => {
    if (_voiceDB) return resolve(_voiceDB);
    try {
      const req = indexedDB.open('yasya-voice', 1);
      req.onupgradeneeded = () => req.result.createObjectStore('phrases');
      req.onsuccess = () => {
        _voiceDB = req.result;
        resolve(_voiceDB);
      };
      req.onerror = () => reject(req.error);
    } catch (e) {
      reject(e);
    }
  });
}

function voiceGet(text) {
  return getVoiceDB()
    .then(
      (db) =>
        new Promise((resolve) => {
          const r = db.transaction('phrases').objectStore('phrases').get(text);
          r.onsuccess = () => resolve(r.result || null);
          r.onerror = () => resolve(null);
        })
    )
    .catch(() => null);
}

function voicePut(text, blob) {
  return getVoiceDB().then(
    (db) =>
      new Promise((resolve, reject) => {
        const r = db.transaction('phrases', 'readwrite').objectStore('phrases').put(blob, text);
        r.onsuccess = resolve;
        r.onerror = () => reject(r.error);
      })
  );
}

function voiceDelete(text) {
  return getVoiceDB().then(
    (db) =>
      new Promise((resolve) => {
        const r = db.transaction('phrases', 'readwrite').objectStore('phrases').delete(text);
        r.onsuccess = resolve;
        r.onerror = resolve;
      })
  );
}

let _voiceAudio = null;

// Синтез речи (системный голос) — запасной вариант
function ttsSpeak(text) {
  try {
    speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    // голос, выбранный в панели родителей (пусто = системный по умолчанию)
    const uri = Settings.voiceURI();
    if (uri) {
      const v = speechSynthesis.getVoices().find((x) => x.voiceURI === uri);
      if (v) {
        u.voice = v;
        u.lang = v.lang;
      }
    }
    if (!u.lang) u.lang = 'ru-RU';
    u.rate = 0.9;
    u.pitch = 1.05;
    speechSynthesis.speak(u);
  } catch (e) {
    console.warn('tts:', e);
  }
}

async function speak(text) {
  if (!Settings.soundOn() || !text) return;
  // есть ли запись голосом родителя?
  const blob = await voiceGet(text);
  if (blob) {
    try {
      speechSynthesis.cancel();
      if (_voiceAudio) _voiceAudio.pause();
      const a = new Audio(URL.createObjectURL(blob));
      _voiceAudio = a;
      a.addEventListener('ended', () => URL.revokeObjectURL(a.src));
      await a.play();
      return;
    } catch {}
  }
  ttsSpeak(text);
}

// Все реплики приложения — для студии записи голоса (tools/record).
// Держать в точном соответствии с фразами в коде игр!
const VOICE_PHRASES = {
  Цвета: ['Покажи красный шарик', 'Покажи синий шарик', 'Покажи жёлтый шарик',
    'Покажи зелёный шарик', 'Покажи оранжевый шарик', 'Покажи фиолетовый шарик'],
  Пары: ['Найди одинаковых зверят', 'собачка', 'кошечка', 'зайчик', 'лисёнок',
    'мишка', 'панда', 'поросёнок', 'корова', 'лягушка', 'лев', 'тигр', 'обезьянка'],
  Счёт: ['Посчитай и покажи число', '1', '2', '3', '4', '5'],
  'Звуки и «Кто сказал?»': ['Кто живёт на дворе?', 'Кто сказал?', 'Корова', 'Собака',
    'Кошка', 'Овечка', 'Поросёнок', 'Лошадь', 'Петух', 'Курочка', 'Коза', 'Пчела',
    'Волк', 'Лев', 'Обезьянка', 'Летучая мышка', 'Птичка', 'Змея'],
  Тени: ['Найди такую же картинку'],
  Раскраска: ['Что будем раскрашивать?', 'Раскрась картинку пальчиком', 'Ух ты, красота!',
    'Раскрась кошечку', 'Раскрась собачку', 'Раскрась зайчика', 'Раскрась лисёнка',
    'Раскрась мишку', 'Раскрась лягушку', 'Раскрась уточку', 'Раскрась бабочку',
    'Раскрась божью коровку', 'Раскрась подсолнух', 'Раскрась дерево',
    'Раскрась яблоко', 'Раскрась клубнику', 'Раскрась машинку', 'Раскрась ракету',
    'Раскрась шарик'],
  Пузыри: ['Лопай пузырьки'],
  Повтори: ['Повтори за мной', 'Попробуй ещё'],
  Корзины: ['Разложи по корзинкам'],
  Большой: ['Где большой?', 'Где маленький?'],
  Лишний: ['Найди лишний предмет'],
  Ряд: ['Продолжи ряд. Что дальше?'],
  Лабиринт: ['Проведи мышку к сыру'],
  Пианино: ['Поиграй на пианино'],
  Панель: ['Привет! Это мой голос.'],
};

// ===== Сохранение прогресса (ключи вида yasya.<game>.<key>) =====
const Progress = {
  get(game, key, def = 0) {
    try {
      return Number(localStorage.getItem(`yasya.${game}.${key}`) ?? def);
    } catch {
      return def;
    }
  },
  add(game, key, amount = 1) {
    try {
      const val = this.get(game, key) + amount;
      localStorage.setItem(`yasya.${game}.${key}`, String(val));
      return val;
    } catch {
      return 0;
    }
  },
  reset() {
    try {
      Object.keys(localStorage)
        .filter((k) => k.startsWith('yasya.'))
        .forEach((k) => localStorage.removeItem(k));
    } catch {}
  },
};

// ===== Праздник: конфетти + экран победы =====
function confetti() {
  const colors = ['#ff6b6b', '#ffd93d', '#6bcb77', '#4d96ff', '#c084fc', '#ff9f43'];
  for (let i = 0; i < 36; i++) {
    const p = document.createElement('i');
    p.className = 'confetti';
    p.style.left = Math.random() * 100 + 'vw';
    p.style.background = colors[i % colors.length];
    p.style.animationDelay = Math.random() * 0.6 + 's';
    p.style.animationDuration = 2 + Math.random() * 1.5 + 's';
    document.body.appendChild(p);
    setTimeout(() => p.remove(), 4200);
  }
}

// Показать экран победы; onAgain — перезапуск игры
function showWin({ homeUrl = '../../index.html', onAgain } = {}) {
  const stars = Progress.add('global', 'stars', 1);
  playSound('success');
  confetti();

  const over = document.createElement('div');
  over.className = 'win';
  over.innerHTML = `
    <div class="win__card">
      <div class="win__emoji">🏆</div>
      <div class="win__title">Молодец!</div>
      <div class="win__stars">⭐ всего: ${stars}</div>
      <button class="btn win__btn">🔁 Ещё раз</button>
      <a class="btn win__btn" href="${homeUrl}">🏠 Домой</a>
    </div>`;
  document.body.appendChild(over);

  over.querySelector('.win__btn').addEventListener('click', () => {
    over.remove();
    if (onAgain) onAgain();
  });
}

// Стартовый экран с большой кнопкой.
// iOS разрешает озвучку только после касания: тап по кнопке разблокирует
// речь, поэтому задание звучит уже в первом раунде, а не со второго.
function showStart({ emoji = '▶️', label = 'Играть', onStart }) {
  const over = document.createElement('div');
  over.className = 'start';
  over.innerHTML = `
    <div class="start__emoji">${emoji}</div>
    <button class="start__btn">${label}</button>`;
  document.body.appendChild(over);
  over.querySelector('.start__btn').addEventListener('click', () => {
    over.remove();
    playSound('pop');
    if (onStart) onStart();
  });
}

// ===== Утилита =====
function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// ===== Drag-and-drop на Pointer Events =====
// Нативный HTML5 DnD не работает с тачем в iOS Safari, поэтому свой.
// makeDraggable(el, { canDrag, onDrop }): onDrop(target, el) вызывается
// при отпускании; target — ближайший предок с классом .drop-target под
// пальцем или null. Просто тап (без движения) в onDrop не попадает.
function makeDraggable(el, { canDrag, onDrop } = {}) {
  el.style.touchAction = 'none';
  el.addEventListener('pointerdown', (e) => {
    if (e.button !== undefined && e.button !== 0) return;
    if (canDrag && !canDrag()) return;
    e.preventDefault();
    try {
      el.setPointerCapture(e.pointerId);
    } catch {}
    let dragging = false;
    let target = null;
    let x = e.clientX;
    let y = e.clientY;
    const x0 = x;
    const y0 = y;

    const setHot = (t) => {
      if (target === t) return;
      if (target) target.classList.remove('drop-hot');
      target = t;
      if (target) target.classList.add('drop-hot');
    };
    const move = (ev) => {
      x = ev.clientX;
      y = ev.clientY;
      if (!dragging && Math.hypot(x - x0, y - y0) > 8) {
        dragging = true;
        el.classList.add('is-dragging');
      }
      if (!dragging) return;
      el.style.transform = `translate(${x - x0}px, ${y - y0}px) scale(1.08)`;
      // спрячем от hit-теста, чтобы найти клетку под пальцем
      el.style.pointerEvents = 'none';
      const hit = document.elementFromPoint(x, y);
      el.style.pointerEvents = '';
      setHot(hit ? hit.closest('.drop-target') : null);
    };
    const up = () => {
      el.removeEventListener('pointermove', move);
      el.removeEventListener('pointerup', up);
      el.removeEventListener('pointercancel', up);
      const drop = target; // цель надо сохранить до очистки подсветки
      setHot(null);
      el.classList.remove('is-dragging');
      // плавно вернуть на место (если игра не переместила сама)
      el.style.transition = 'transform .25s ease';
      el.style.transform = '';
      setTimeout(() => (el.style.transition = ''), 300);
      if (dragging && onDrop) onDrop(drop, el);
    };
    el.addEventListener('pointermove', move);
    el.addEventListener('pointerup', up);
    el.addEventListener('pointercancel', up);
  });
}

// Плавающие фигурки на фоне — на каждой странице, для настроения
(function decor() {
  const shapes = ['☀️', '☁️', '⭐', '🌈', '🎈', '☁️', '⭐'];
  const layer = document.createElement('div');
  layer.className = 'bg-decor';
  shapes.forEach((s, i) => {
    const el = document.createElement('span');
    el.textContent = s;
    el.style.left = 6 + i * 14 + Math.random() * 7 + '%';
    el.style.top = 4 + Math.random() * 82 + '%';
    el.style.fontSize = 26 + Math.random() * 40 + 'px';
    el.style.animationDelay = Math.random() * 3 + 's';
    el.style.animationDuration = 5 + Math.random() * 5 + 's';
    layer.appendChild(el);
  });
  document.body.appendChild(layer);
})();

// Service Worker: офлайн-режим после первой загрузки.
// Путь считаем от src этого скрипта (js/core.js) — работает с любой глубины страниц.
// На localhost не включаем, чтобы правки при разработке были видны сразу;
// офлайн тестируем на задеплоенном URL.
(function registerSW() {
  if (!('serviceWorker' in navigator)) return;
  if (location.hostname === 'localhost' || location.hostname === '127.0.0.1') return;
  const script = document.currentScript;
  if (!script || !script.src) return;
  const swUrl = new URL('../sw.js', script.src).href;
  window.addEventListener('load', () => {
    navigator.serviceWorker.register(swUrl).catch((e) => console.warn('sw:', e));
  });
})();
