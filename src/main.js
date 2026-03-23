import { Game } from './game/Game.js';
import { saveHighScore, renderHighScores } from './ui/HighScores.js';

// --- Element references ---
const screens = {
  menu:       document.getElementById('menu'),
  game:       document.getElementById('game-screen'),
  pause:      document.getElementById('pause-screen'),
  gameover:   document.getElementById('gameover-screen'),
  highscores: document.getElementById('highscores-screen'),
};

const canvas      = document.getElementById('game-canvas');
const scoreEl     = document.getElementById('score-value');
const livesEl     = document.getElementById('lives-value');
const levelEl     = document.getElementById('level-value');
const finalScoreEl = document.getElementById('final-score');
const playerNameEl = document.getElementById('player-name');
const scoresList  = document.getElementById('scores-list');

let game = null;

// --- Screen helpers ---
function showScreen(name) {
  for (const [key, el] of Object.entries(screens)) {
    el.classList.toggle('hidden', key !== name);
  }
}

function showOverlay(name) {
  screens[name].classList.remove('hidden');
}

function hideOverlay(name) {
  screens[name].classList.add('hidden');
}

// --- Game callbacks ---
function handleScoreChange(score) {
  scoreEl.textContent = score;
}

function handleLivesChange(lives) {
  livesEl.textContent = lives;
}

function handleLevelChange(level) {
  levelEl.textContent = level;
}

function handleGameOver(score) {
  finalScoreEl.textContent = score;
  playerNameEl.value = '';
  showOverlay('gameover');
}

// --- Game control ---
function startGame() {
  scoreEl.textContent = '0';
  livesEl.textContent = '3';
  levelEl.textContent = '1';

  if (game) game.stop();
  game = new Game(
    canvas,
    handleGameOver,
    handleScoreChange,
    handleLivesChange,
    handleLevelChange,
  );

  showScreen('game');
  game.start();
}

// --- Event listeners ---
document.getElementById('btn-start').addEventListener('click', startGame);

document.getElementById('btn-highscores').addEventListener('click', () => {
  renderHighScores(scoresList);
  showScreen('highscores');
});

document.getElementById('btn-back-from-scores').addEventListener('click', () => {
  showScreen('menu');
});

document.getElementById('btn-pause').addEventListener('click', () => {
  if (game) { game.pause(); showOverlay('pause'); }
});

document.getElementById('btn-resume').addEventListener('click', () => {
  hideOverlay('pause');
  if (game) game.resume();
});

document.getElementById('btn-menu-from-pause').addEventListener('click', () => {
  hideOverlay('pause');
  if (game) game.stop();
  showScreen('menu');
});

document.getElementById('btn-save-score').addEventListener('click', () => {
  const name = playerNameEl.value;
  const score = parseInt(finalScoreEl.textContent, 10) || 0;
  saveHighScore(name, score);
  hideOverlay('gameover');
  renderHighScores(scoresList);
  showScreen('highscores');
});

document.getElementById('btn-play-again').addEventListener('click', () => {
  hideOverlay('gameover');
  startGame();
});

document.getElementById('btn-menu-from-gameover').addEventListener('click', () => {
  hideOverlay('gameover');
  showScreen('menu');
});

// Pause via keyboard (dispatched from Game)
document.addEventListener('game:pause', () => {
  showOverlay('pause');
});
