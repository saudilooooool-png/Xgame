import { FORMATION_NAMES } from '../ai/Formations.js';

const FORMATION_ICONS = {
  wedge:   '▲ Wedge',
  circle:  '● Circle',
  scatter: '✦ Scatter',
  line:    '━ Line',
  defend:  '⬡ Defend',
};

const FORMATION_TIPS = {
  wedge:   'هجوم مركّز — اخترق صفوف الأعداء',
  circle:  'دفاع 360° — احمِ نقطة معينة',
  scatter: 'تشتّت — تجنّب الضربات الجماعية',
  line:    'جدار دفاعي — أوقف تقدّم الأعداء',
  defend:  'حماية الهدف — التف حول النقطة الزرقاء',
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
      btn.title = FORMATION_TIPS[name] ?? '';
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

    // AI toggle button
    this._aiBtn = document.createElement('button');
    this._aiBtn.textContent = '⬡ AI: OFF';
    this._aiBtn.style.cssText = `
      background:rgba(40,0,60,0.85); color:#cc88ff;
      border:1px solid #cc88ff44; border-radius:6px;
      padding:8px 14px; font-size:13px; cursor:pointer;
      font-family:monospace; letter-spacing:0.5px;
    `;
    this._aiBtn.addEventListener('click', () => this._onAIToggle());
    panel.appendChild(this._aiBtn);

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
    hint.textContent = '🖱 انقر لتحريك الأسراب   |   الأزرار أدناه: غيّر التشكيل';
    document.body.appendChild(hint);
  }

  _bindEvents() {
    this.canvas.el.addEventListener('click', (e) => {
      if (this.game.aiMode) return; // ignore clicks in AI mode
      const rect = this.canvas.el.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      this._onTargetClick(x, y);
    });
  }

  _onAIToggle() {
    this.game.toggleAI();
    const on = this.game.aiMode;
    const label = on
      ? `⬡ AI: ${this.game.agent.statusLabel}`
      : '⬡ AI: OFF';
    this._aiBtn.textContent = label;
    this._aiBtn.style.background = on ? 'rgba(80,0,120,0.9)' : 'rgba(40,0,60,0.85)';
    this._aiBtn.style.borderColor = on ? '#cc88ff' : '#cc88ff44';
    this._aiBtn.style.color = on ? '#ee99ff' : '#cc88ff';

    // update label once model finishes loading
    if (on) {
      const poll = setInterval(() => {
        const lbl = this.game.agent.statusLabel;
        this._aiBtn.textContent = `⬡ AI: ${lbl}`;
        if (lbl !== '⟳') clearInterval(poll);
      }, 500);
    }
  }

  _onTargetClick(x, y) {
    this._targetZoneDisplay = { x, y, alpha: 1 };
    this.swarm.setTargetZone(x, y);
    this.game.audio.targetSet();

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
    this.game.audio.formationChange();

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
    const g = this.game;
    return {
      timestamp: Date.now(),
      wave: g.wave,
      score: g.score,
      objectiveHealth: g.objective.health,
      objectiveX: +(g.objective.x.toFixed(1)),
      objectiveY: +(g.objective.y.toFixed(1)),
      friendlyCount: g.playerSwarm.drones.length,
      enemyCount: g.enemySwarm.drones.length,
      friendlyDrones: g.playerSwarm.serializeState(),
      enemyDrones: g.enemySwarm.serializeState(),
      currentFormation: g.playerSwarm.currentFormation,
      waveKills: g.waveKills,
      waveLosses: g.waveLosses,
      threatScore: +(g.threatScore().toFixed(3)),
      enemyRoles: g.enemySwarm.drones.reduce((acc, d) => {
        acc[d.role ?? 'rusher'] = (acc[d.role ?? 'rusher'] ?? 0) + 1;
        return acc;
      }, {}),
    };
  }

  _evaluateOutcome(targetX, targetY) {
    const g = this.game;
    const { drones } = g.playerSwarm;
    const snapKills     = g.waveKills;
    const snapLosses    = g.waveLosses;
    const snapThreat    = +(g.threatScore().toFixed(3));
    const snapObjHealth = g.objective.health;

    let reached = false;
    if (targetX && drones.length > 0) {
      const cx = drones.reduce((s, d) => s + d.x, 0) / drones.length;
      const cy = drones.reduce((s, d) => s + d.y, 0) / drones.length;
      reached = Math.sqrt((cx - targetX) ** 2 + (cy - targetY) ** 2) < 100;
    }

    return {
      reached,
      kills:           snapKills,
      losses:          snapLosses,
      threatScore:     snapThreat,
      objectiveHealth: snapObjHealth,
      reward: (snapKills - snapLosses) + (reached ? 1 : -0.5) + (1 - snapThreat) * 2,
    };
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
