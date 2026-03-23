/**
 * Converts raw DataCollector samples into normalised feature vectors.
 *
 * Input features (16 values):
 *   [0]  objectiveHealth / 100
 *   [1]  friendlyCount / 20
 *   [2]  enemyCount / 40
 *   [3]  wave / 10  (capped)
 *   [4]  friendlyCentroidX / canvasWidth
 *   [5]  friendlyCentroidY / canvasHeight
 *   [6]  enemyCentroidX / canvasWidth
 *   [7]  enemyCentroidY / canvasHeight
 *   [8]  objX / canvasWidth
 *   [9]  objY / canvasHeight
 *   [10] dist(friendlyCentroid, obj) / diagonal
 *   [11] dist(enemyCentroid, obj) / diagonal
 *   [12-16] one-hot formation (wedge, circle, scatter, line, defend)
 *
 * Outputs:
 *   formationIndex  0-4  (classification)
 *   targetX         0-1  (normalised, regression)
 *   targetY         0-1  (regression)
 */

export const FORMATIONS = ['wedge', 'circle', 'scatter', 'line', 'defend'];
export const CANVAS_W = 1280;  // reference canvas size
export const CANVAS_H = 720;
export const FEATURE_SIZE = 17;

export function sampleToFeatures(sample) {
  const gs = sample.gameState;
  if (!gs) return null;

  const cw = CANVAS_W, ch = CANVAS_H;
  const diag = Math.sqrt(cw * cw + ch * ch);

  // centroids
  const fc = centroid(gs.friendlyDrones ?? []);
  const ec = centroid(gs.enemyDrones ?? []);
  const ox = gs.objectiveX ?? cw / 2;
  const oy = gs.objectiveY ?? ch / 2;

  const formationIdx = FORMATIONS.indexOf(gs.currentFormation ?? 'wedge');
  const oneHot = FORMATIONS.map((_, i) => (i === formationIdx ? 1 : 0));

  const features = [
    clamp(gs.objectiveHealth ?? 100) / 100,
    clamp(gs.friendlyCount ?? 0, 0, 20) / 20,
    clamp(gs.enemyCount ?? 0, 0, 40) / 40,
    clamp(gs.wave ?? 1, 1, 10) / 10,
    fc.x / cw,
    fc.y / ch,
    ec.x / cw,
    ec.y / ch,
    ox / cw,
    oy / ch,
    dist(fc.x, fc.y, ox, oy) / diag,
    dist(ec.x, ec.y, ox, oy) / diag,
    ...oneHot,
  ];

  return features;
}

export function sampleToLabels(sample) {
  const action = sample.action;
  if (!action) return null;

  const formationIdx = FORMATIONS.indexOf(action.formation ?? 'wedge');
  const targetX = clamp((action.targetX ?? CANVAS_W / 2) / CANVAS_W);
  const targetY = clamp((action.targetY ?? CANVAS_H / 2) / CANVAS_H);

  return { formationIdx: Math.max(0, formationIdx), targetX, targetY };
}

export function prepareBatch(samples) {
  const xs = [], formLabels = [], xyLabels = [];

  for (const s of samples) {
    if (!s.gameState || !s.action) continue;
    const features = sampleToFeatures(s);
    const labels = sampleToLabels(s);
    if (!features || !labels) continue;

    xs.push(features);
    formLabels.push(labels.formationIdx);
    xyLabels.push([labels.targetX, labels.targetY]);
  }

  return { xs, formLabels, xyLabels, count: xs.length };
}

// ── helpers ───────────────────────────────────────────────────────────────────

function centroid(drones) {
  if (!drones.length) return { x: CANVAS_W / 2, y: CANVAS_H / 2 };
  const sx = drones.reduce((s, d) => s + d.x, 0);
  const sy = drones.reduce((s, d) => s + d.y, 0);
  return { x: sx / drones.length, y: sy / drones.length };
}

function dist(x1, y1, x2, y2) {
  return Math.sqrt((x2 - x1) ** 2 + (y2 - y1) ** 2);
}

function clamp(v, min = 0, max = 1) {
  return Math.max(min, Math.min(max, v));
}
