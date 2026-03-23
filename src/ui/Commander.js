import { FORMATION_NAMES } from '../ai/Formations.js';

const FORMATION_ICONS = {
  wedge:   '▲ Wedge',
  circle:  '● Circle',
  scatter: '✦ Scatter',
  line:    '━ Line',
  defend:  '⬡ Defend',
};

export class Commander {
  constructor(canvas, swarm, dataCollector, game) {
    this.canvas = canvas;
    this.swarm = swarm;
    this.dataCollector = dataCollector;
    this.game = game;

    this._targetZoneDisplay = null; // {x, y, alpha}
    this._buttons = [];

    this._buildUI();
    this._bindEvents();
  }

  _buildUI() {
    // Formation buttons panel
    const panel = document.createElement('div');
    panel.id = 'formation-panel';
    panel.style.cssText = `
      position:fixed; bottom:20px; left:50%; transform:translateX(-50%);
      display:flex; gap:8px; z-index:100;
    `;

    FORMATION_NAMES.forEach((name) => {
      const btn = document.createElement('button');
      btn.textContent = FORMATION_ICONS[name] ?? name;
      btn.dataset.formation = name;
      btn.style.cssText = `
        background:rgba(0,20,40,0.85); color:#00d4ff;
        border:1px solid #00d4ff44; border-radius:6px;
        padding:8px 14px; font-size:13px; cursor:pointer;
        font-family:monospace; transition:all 0.15s;
        letter-spacing:0.5px;
      `;
      btn.addEventListener('mouseenter', () => {
        btn.style.background = 'rgba(0,180,255,0.2)';
        btn.style.borderColor = '#00d4ff';
      });
      btn.addEventListener('mouseleave', () => {
        btn.style.background = btn.dataset.active
          ? 'rgba(0,180,255,0.25)'
          : 'rgba(0,20,40,0.85)';
        btn.style.borderColor = btn.dataset.active ? '#00d4ff' : '#00d4ff44';
      });
      btn.addEventListener('click', () => this._onFormationClick(name, btn));
      panel.appendChild(btn);
      this._buttons.push(btn);
    });

    // Download button
    const dlBtn = document.createElement('button');
    dlBtn.textContent = '⬇ Export Data';
    dlBtn.style.cssText = `
      background:rgba(0,40,20,0.85); color:#00ff88;
      border:1px solid #00ff8844; border-radius:6px;
      padding:8px 14px; font-size:13px; cursor:pointer;
      font-family:monospace;
    `;
    dlBtn.addEventListener('click', () => this.dataCollector.download());
    panel.appendChild(dlBtn);

    document.body.appendChild(panel);

    // Hint label
    const hint = document.createElement('div');
    hint.style.cssText = `
      position:fixed; top:14px; left:50%; transform:translateX(-50%);
      color:rgba(0,212,255,0.5); font-family:monospace; font-size:12px;
      pointer-events:none; z-index:100;
    `;
    hint.textContent = 'LEFT CLICK — set target zone   |   BUTTONS — change formation';
    document.body.appendChild(hint);
  }

  _bindEvents() {
    this.canvas.el.addEventListener('click', (e) => {
      const rect = this.canvas.el.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      this._onTargetClick(x, y);
    });
  }

  _onTargetClick(x, y) {
    this._targetZoneDisplay = { x, y, alpha: 1 };
    this.swarm.setTargetZone(x, y);

    const gs = this._captureGameState();
    const action = {
      type: 'target_zone',
      formation: this.swarm.currentFormation,
      targetX: +(x.toFixed(1)),
      targetY: +(y.toFixed(1)),
      wave: this.game.wave,
      score: this.game.score,
      _resolveAfter: () => this._evaluateOutcome(x, y),
    };
    this.dataCollector.recordDecision(gs, action);
  }

  _onFormationClick(name, btn) {
    this._buttons.forEach((b) => {
      b.dataset.active = '';
      b.style.background = 'rgba(0,20,40,0.85)';
      b.style.borderColor = '#00d4ff44';
    });
    btn.dataset.active = '1';
    btn.style.background = 'rgba(0,180,255,0.25)';
    btn.style.borderColor = '#00d4ff';

    const tz = this.swarm.targetZone;
    this.swarm.setFormation(name, tz?.x, tz?.y);

    const gs = this._captureGameState();
    const action = {
      type: 'formation_change',
      formation: name,
      wave: this.game.wave,
      score: this.game.score,
      _resolveAfter: () => this._evaluateOutcome(tz?.x, tz?.y),
    };
    this.dataCollector.recordDecision(gs, action);
  }

  _captureGameState() {
    return {
      timestamp: Date.now(),
      wave: this.game.wave,
      score: this.game.score,
      objectiveHealth: this.game.objective.health,
      objectiveX: +(this.game.objective.x.toFixed(1)),
      objectiveY: +(this.game.objective.y.toFixed(1)),
      friendlyCount: this.game.playerSwarm.drones.length,
      enemyCount: this.game.enemySwarm.drones.length,
      friendlyDrones: this.game.playerSwarm.serializeState(),
      enemyDrones: this.game.enemySwarm.serializeState(),
      currentFormation: this.game.playerSwarm.currentFormation,
    };
  }

  _evaluateOutcome(targetX, targetY) {
    const { drones } = this.game.playerSwarm;
    if (!targetX || drones.length === 0) return 'unknown';
    const centroidX = drones.reduce((s, d) => s + d.x, 0) / drones.length;
    const centroidY = drones.reduce((s, d) => s + d.y, 0) / drones.length;
    const dx = centroidX - targetX;
    const dy = centroidY - targetY;
    const dist = Math.sqrt(dx * dx + dy * dy);
    return dist < 100 ? 'reached' : 'missed';
  }

  drawTargetZone(ctx) {
    if (!this._targetZoneDisplay) return;
    const { x, y, alpha } = this._targetZoneDisplay;

    ctx.save();
    ctx.strokeStyle = `rgba(0,212,255,${alpha * 0.6})`;
    ctx.lineWidth = 1.5;
    ctx.setLineDash([4, 4]);
    ctx.beginPath();
    ctx.arc(x, y, 30, 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);

    ctx.fillStyle = `rgba(0,212,255,${alpha * 0.08})`;
    ctx.beginPath();
    ctx.arc(x, y, 30, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = `rgba(0,212,255,${alpha * 0.9})`;
    ctx.lineWidth = 1;
    const s = 6;
    ctx.beginPath();
    ctx.moveTo(x - s, y); ctx.lineTo(x + s, y);
    ctx.moveTo(x, y - s); ctx.lineTo(x, y + s);
    ctx.stroke();
    ctx.restore();

    this._targetZoneDisplay.alpha = Math.max(0.3, alpha - 0.004);
  }
}
