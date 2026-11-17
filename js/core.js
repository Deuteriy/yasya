// ===== Общее ядро для всех игр =====

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

// Простой тон-звук без внешних файлов: type 'pop' | 'success' | 'fail'
function playSound(kind = 'pop') {
  try {
    const ctx = getAudioCtx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);

    const now = ctx.currentTime;
    if (kind === 'success') {
      // бодрая восходящая арпеджио-фраза
      const notes = [523.25, 659.25, 783.99]; // C5 E5 G5
      notes.forEach((freq, i) => {
        const t = now + i * 0.12;
        osc.frequency.setValueAtTime(freq, t);
        gain.gain.setValueAtTime(0.25, t);
        gain.gain.exponentialRampToValueAtTime(0.001, t + 0.3);
        if (i < notes.length - 1) {
          osc.frequency.setValueAtTime(freq, t);
        }
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

// Сохранение прогресса в localStorage (ключи вида yasya.<game>.<key>)
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
};

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
