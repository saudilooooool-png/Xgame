/**
 * AI Agent — Behavioural Cloning commander
 *
 * Loads the TF.js model from the server and replaces the human player.
 * Falls back to a rule-based heuristic when no model is available.
 *
 * Decision interval: every TICK_INTERVAL seconds the agent:
 *   1. Builds a feature vector from the current game state
 *   2. Runs inference (model or heuristic)
 *   3. Issues formation + target zone commands to the swarm
 */

const MODEL_URL = 'http://localhost:4000/api/model/model.json';
const TICK_INTERVAL = 2.5; // seconds between agent decisions
const FORMATIONS = ['wedge', 'circle', 'scatter', 'line', 'defend'];
const CANVAS_W = 1280;
const CANVAS_H = 720;

export class Agent {
  constructor(swarm, game) {
    this.swarm = swarm;
    this.game = game;
    this.active = false;
    this._model = null;
    this._tick = 0;
    this._lastDecision = null;
    this._status = 'idle'; // idle | loading | ready | heuristic | error
  }

  async load() {
    this._status = 'loading';
    try {
      // dynamic import so tfjs doesn't load unless AI mode is activated
      const tf = await import('https://cdn.jsdelivr.net/npm/@tensorflow/tfjs@4.22.0/dist/tf.min.js');
      this._tf = tf;
      this._model = await tf.loadLayersModel(MODEL_URL);
      this._status = 'ready';
      console.log('[Agent] Model loaded ✓');
    } catch (err) {
      console.warn('[Agent] Model not available, using heuristic:', err.message);
      this._status = 'heuristic';
    }
    this.active = true;
  }

  update(dt) {
    if (!this.active) return;
    this._tick += dt;
    if (this._tick >= TICK_INTERVAL) {
      this._tick = 0;
      this._decide();
    }
  }

  async _decide() {
    const state = this._buildState();

    if (this._model && this._status === 'ready') {
      await this._mlDecide(state);
    } else {
      this._heuristicDecide(state);
    }
  }

  // ── ML inference ────────────────────────────────────────────────────────────

  async _mlDecide(state) {
    const tf = this._tf;
    const input = tf.tensor2d([state.features]);
    const [formTensor, posTensor] = this._model.predict(input);

    const formProbs = await formTensor.data();
    const pos = await posTensor.data();

    const formIdx = formProbs.indexOf(Math.max(...formProbs));
    const tx = pos[0] * (this.game.canvas.width);
    const ty = pos[1] * (this.game.canvas.height);

    input.dispose(); formTensor.dispose(); posTensor.dispose();

    this._apply(FORMATIONS[formIdx], tx, ty);
  }

  // ── Rule-based heuristic (fallback) ─────────────────────────────────────────

  _heuristicDecide(state) {
    const { friendlyCentroid, enemyCentroid, objective, friendlyCount, enemyCount, objectiveHealth } = state;

    // Threat score: how close is enemy centroid to objective?
    const enemyThreat = 1 - Math.min(state.distEnemyToObj, 1);
    // Outnumbered ratio
    const ratio = enemyCount / Math.max(friendlyCount, 1);

    let formation, tx, ty;

    if (objectiveHealth < 40) {
      // Desperate defense — form a ring around the objective
      formation = 'defend';
      tx = objective.x;
      ty = objective.y;
    } else if (enemyThreat > 0.7 && ratio < 1.2) {
      // Enemy closing in, we have numbers — aggressive wedge intercept
      formation = 'wedge';
      tx = enemyCentroid.x;
      ty = enemyCentroid.y;
    } else if (ratio > 2) {
      // Hugely outnumbered — scatter to avoid mass losses
      formation = 'scatter';
      tx = (objective.x + enemyCentroid.x) / 2;
      ty = (objective.y + enemyCentroid.y) / 2;
    } else if (enemyThreat > 0.4) {
      // Intercept with a line
      formation = 'line';
      tx = (friendlyCentroid.x + enemyCentroid.x) / 2;
      ty = (friendlyCentroid.y + enemyCentroid.y) / 2;
    } else {
      // Sweep — move toward enemy cluster in circle
      formation = 'circle';
      tx = enemyCentroid.x;
      ty = enemyCentroid.y;
    }

    // Add small jitter to avoid oscillation
    tx += (Math.random() - 0.5) * 40;
    ty += (Math.random() - 0.5) * 40;

    this._apply(formation, tx, ty);
  }

  // ── Apply decision to swarm ─────────────────────────────────────────────────

  _apply(formation, tx, ty) {
    const cw = this.game.canvas.width;
    const ch = this.game.canvas.height;
    tx = Math.max(30, Math.min(cw - 30, tx));
    ty = Math.max(30, Math.min(ch - 30, ty));

    this._lastDecision = { formation, tx, ty };
    this.swarm.setTargetZone(tx, ty);
    this.swarm.setFormation(formation, tx, ty);
  }

  // ── Feature vector ──────────────────────────────────────────────────────────

  _buildState() {
    const g = this.game;
    const cw = g.canvas.width, ch = g.canvas.height;
    const diag = Math.sqrt(cw * cw + ch * ch);

    const fd = g.playerSwarm.drones;
    const ed = g.enemySwarm.drones;
    const fc = centroid(fd, cw / 2, ch / 2);
    const ec = centroid(ed, cw / 2, ch / 2);
    const ox = g.objective.x, oy = g.objective.y;

    const formIdx = FORMATIONS.indexOf(g.playerSwarm.currentFormation);
    const oneHot = FORMATIONS.map((_, i) => (i === formIdx ? 1 : 0));

    const distFtoObj = dist(fc.x, fc.y, ox, oy) / diag;
    const distEtoObj = dist(ec.x, ec.y, ox, oy) / diag;

    const features = [
      clamp(g.objective.health) / 100,
      clamp(fd.length, 0, 20) / 20,
      clamp(ed.length, 0, 40) / 40,
      clamp(g.wave, 1, 10) / 10,
      fc.x / cw, fc.y / ch,
      ec.x / cw, ec.y / ch,
      ox / cw, oy / ch,
      distFtoObj,
      distEtoObj,
      ...oneHot,
    ];

    return {
      features,
      friendlyCentroid: fc,
      enemyCentroid: ec,
      objective: { x: ox, y: oy },
      friendlyCount: fd.length,
      enemyCount: ed.length,
      objectiveHealth: g.objective.health,
      distEnemyToObj: distEtoObj,
    };
  }

  get statusLabel() {
    const icons = { idle: '—', loading: '⟳', ready: '🤖 ML', heuristic: '⬡ Rule', error: '✗' };
    return icons[this._status] ?? this._status;
  }

  get lastDecision() { return this._lastDecision; }
}

function centroid(drones, defX, defY) {
  if (!drones.length) return { x: defX, y: defY };
  return {
    x: drones.reduce((s, d) => s + d.x, 0) / drones.length,
    y: drones.reduce((s, d) => s + d.y, 0) / drones.length,
  };
}

function dist(x1, y1, x2, y2) { return Math.sqrt((x2 - x1) ** 2 + (y2 - y1) ** 2); }
function clamp(v, min = 0, max = 1) { return Math.max(min, Math.min(max, v)); }
