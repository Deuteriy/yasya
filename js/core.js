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
    window.removeEventListener('mousedown', unlock);
  };
  window.addEventListener('touchstart', unlock, { passive: true });
  window.addEventListener('mousedown', unlock);
})();

// Простой тон-звук без внешних файлов: kind 'pop' | 'success' | 'fail'
function playSound(kind = 'pop') {
  if (!Settings.soundOn()) return;
  try {
    const ctx = getAudioCtx();
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

// ===== Речь (озвучка заданий; на iOS тоже требует первого касания) =====
function speak(text) {
  if (!Settings.soundOn() || !text) return;
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
