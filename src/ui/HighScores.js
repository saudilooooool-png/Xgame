const STORAGE_KEY = 'xgame_highscores';
const MAX_SCORES = 10;

export function getHighScores() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY)) ?? [];
  } catch {
    return [];
  }
}

export function saveHighScore(name, score) {
  const scores = getHighScores();
  scores.push({ name: name.trim() || 'Anonymous', score });
  scores.sort((a, b) => b.score - a.score);
  scores.splice(MAX_SCORES);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(scores));
  return scores;
}

export function renderHighScores(listEl) {
  const scores = getHighScores();
  listEl.innerHTML = '';
  if (!scores.length) {
    listEl.innerHTML = '<li style="color:#888">No scores yet</li>';
    return;
  }
  for (const { name, score } of scores) {
    const li = document.createElement('li');
    li.innerHTML = `<span>${name}</span><span>${score}</span>`;
    listEl.appendChild(li);
  }
}
