// Логика хаба: звук нажатия на плитки
document.querySelectorAll('.tile').forEach((tile) => {
  tile.addEventListener('click', () => playSound('pop'));
});
