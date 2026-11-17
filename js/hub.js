// Логика хаба: звук нажатия + панель для родителей (долгий тап по заголовку)

document.querySelectorAll('.tile').forEach((tile) => {
  tile.addEventListener('click', () => playSound('pop'));
});

// ===== Панель для родителей =====
const title = document.getElementById('title');
let pressTimer = null;

title.addEventListener('pointerdown', () => {
  pressTimer = setTimeout(openPanel, 800);
});
['pointerup', 'pointerleave', 'pointercancel'].forEach((ev) =>
  title.addEventListener(ev, () => clearTimeout(pressTimer))
);

function openPanel() {
  if (document.querySelector('.panel')) return;

  const panel = document.createElement('div');
  panel.className = 'panel';
  panel.innerHTML = `
    <div class="panel__card">
      <div class="panel__title">Родителям</div>
      <div class="panel__row">
        <span>🔊 Звук</span>
        <button class="switch ${Settings.soundOn() ? 'on' : ''}" id="sound"></button>
      </div>
      <div class="panel__row"><span>⭐ Звёздочек: ${Progress.get('global', 'stars')}</span></div>
      <button class="btn" id="reset">🗑 Сбросить прогресс</button>
      <button class="btn" id="close">Закрыть</button>
    </div>`;
  document.body.appendChild(panel);

  panel.querySelector('#sound').addEventListener('click', (e) => {
    const on = !Settings.soundOn();
    Settings.setSound(on);
    e.currentTarget.classList.toggle('on', on);
    playSound('pop');
  });

  panel.querySelector('#close').addEventListener('click', () => panel.remove());
  panel.addEventListener('click', (e) => {
    if (e.target === panel) panel.remove();
  });

  // сброс в два тапа, чтобы ребёнок случайно не стёр прогресс
  const resetBtn = panel.querySelector('#reset');
  let armed = false;
  resetBtn.addEventListener('click', () => {
    if (!armed) {
      armed = true;
      resetBtn.textContent = 'Точно сбросить?';
      return;
    }
    Progress.reset();
    panel.remove();
  });
}
