import { FORMATION_NAMES } from '../ai/Formations.js';
import { ResourcesPanel } from './ResourcesPanel.js';

const FORMATION_ICONS = {
  wedge:   '▲',
  circle:  '●',
  scatter: '✦',
  line:    '━',
  defend:  '⬡',
};

const FORMATION_LABELS = {
  wedge:   'هجوم',
  circle:  'دفاع',
  scatter: 'تفرق',
  line:    'خط',
  defend:  'حماية',
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

    this._targetZoneDisplay = null;
    this._buttons = [];
    this._resourcesPanel = null;

    this._buildUI();
    this._bindEvents();
  }

  _buildUI() {
    // ── Formation buttons panel ─────────────────────────────────────────────
    const panel = document.createElement('div');
    panel.id = 'formation-panel';
    panel.style.cssText = `
      position: fixed;
      bottom: 16px;
      left: 50%;
      transform: translateX(-50%);
      display: flex;
      gap: 6px;
      z-index: 100;
    `;

    // Formation buttons
    FORMATION_NAMES.forEach((name) => {
      const btn = document.createElement('button');
      btn.innerHTML = `
        <span style="font-size:16px; display:block; line-height:1;">${FORMATION_ICONS[name] ?? name}</span>
        <span style="font-size:9px; display:block; opacity:0.7; margin-top:2px; letter-spacing:0.5px;">${FORMATION_LABELS[name] ?? name}</span>
      `;
      btn.dataset.formation = name;
      btn.title = FORMATION_TIPS[name] ?? '';
      btn.style.cssText = `
        background: rgba(0, 20, 40, 0.88);
        color: #00d4ff;
        border: 1px solid rgba(0, 212, 255, 0.3);
        border-radius: 10px;
        padding: 10px 14px;
        min-width: 58px;
        font-family: monospace;
        transition: all 0.15s;
        text-align: center;
      `;
      btn.addEventListener('pointerenter', () => {
        if (!btn.dataset.active) {
          btn.style.background = 'rgba(0, 180, 255, 0.18)';
          btn.style.borderColor = 'rgba(0, 212, 255, 0.7)';
        }
      });
      btn.addEventListener('pointerleave', () => {
        if (!btn.dataset.active) {
          btn.style.background = 'rgba(0, 20, 40, 0.88)';
          btn.style.borderColor = 'rgba(0, 212, 255, 0.3)';
        }
      });
      btn.addEventListener('click', () => this._onFormationClick(name, btn));
      panel.appendChild(btn);
      this._buttons.push(btn);
    });

    // ── Resources toggle button ─────────────────────────────────────────────
    this._resBtn = document.createElement('button');
    this._resBtn.innerHTML = `
      <span style="font-size:16px; display:block; line-height:1;">🏙</span>
      <span style="font-size:9px; display:block; opacity:0.7; margin-top:2px; letter-spacing:0.5px;">موارد</span>
    `;
    this._resBtn.style.cssText = `
      background: rgba(0, 30, 20, 0.88);
      color: #00ff88;
      border: 1px solid rgba(0, 255, 136, 0.3);
      border-radius: 10px;
      padding: 10px 14px;
      min-width: 58px;
      font-family: monospace;
      transition: all 0.15s;
      text-align: center;
    `;
    this._resBtn.addEventListener('click', () => {
      this._resourcesPanel.toggle();
      const on = this._resourcesPanel._visible;
      this._resBtn.style.background    = on ? 'rgba(0, 100, 60, 0.9)'   : 'rgba(0, 30, 20, 0.88)';
      this._resBtn.style.borderColor   = on ? 'rgba(0, 255, 136, 0.8)'  : 'rgba(0, 255, 136, 0.3)';
    });
    panel.appendChild(this._resBtn);

    // ── AI toggle button ────────────────────────────────────────────────────
    this._aiBtn = document.createElement('button');
    this._aiBtn.innerHTML = `
      <span style="font-size:16px; display:block; line-height:1;">⬡</span>
      <span style="font-size:9px; display:block; opacity:0.7; margin-top:2px; letter-spacing:0.5px;">AI: OFF</span>
    `;
    this._aiBtn.style.cssText = `
      background: rgba(40, 0, 60, 0.88);
      color: #cc88ff;
      border: 1px solid rgba(204, 136, 255, 0.3);
      border-radius: 10px;
      padding: 10px 14px;
      min-width: 58px;
      font-family: monospace;
      transition: all 0.15s;
      text-align: center;
    `;
    this._aiBtn.addEventListener('click', () => this._onAIToggle());
    panel.appendChild(this._aiBtn);

    // ── Export Data button ──────────────────────────────────────────────────
    const dlBtn = document.createElement('button');
    dlBtn.innerHTML = `
      <span style="font-size:16px; display:block; line-height:1;">⬇</span>
      <span style="font-size:9px; display:block; opacity:0.7; margin-top:2px; letter-spacing:0.5px;">Export</span>
    `;
    dlBtn.style.cssText = `
      background: rgba(0, 40, 20, 0.88);
      color: #00ff88;
      border: 1px solid rgba(0, 255, 136, 0.25);
      border-radius: 10px;
      padding: 10px 14px;
      min-width: 58px;
      font-family: monospace;
      transition: all 0.15s;
      text-align: center;
    `;
    dlBtn.addEventListener('click', () => this.dataCollector.download());
    panel.appendChild(dlBtn);

    document.body.appendChild(panel);

    // ── Top hint ───────────────────────────────────────────────────────────
    const hint = document.createElement('div');
    hint.style.cssText = `
      position: fixed;
      top: 12px;
      left: 50%;
      transform: translateX(-50%);
      color: rgba(0, 212, 255, 0.4);
      font-family: monospace;
      font-size: 11px;
      pointer-events: none;
      z-index: 100;
      white-space: nowrap;
    `;
    hint.textContent = 'حرّك الفأرة/إصبعك لتوجيه الأسراب  ·  R: قائمة سريعة  ·  الأزرار أدناه: التشكيل';
    document.body.appendChild(hint);

    // ── Resources panel (created after game is ready) ──────────────────────
    // Defer creation so game.cityResources is initialized
    this._resourcesPanel = new ResourcesPanel(this.game);
  }

  _bindEvents() {
    const canvas = this.canvas.el;

    // Mobile smooth-target state
    this._mobileRawX   = null;
    this._mobileRawY   = null;
    this._mobileSmoothX = canvas.width  / 2;
    this._mobileSmoothY = canvas.height / 2;
    // Joystick origin (where finger first landed)
    this._joyOriginX = 0;
    this._joyOriginY = 0;
    this._joyActive  = false;

    // ── Mouse-follow (desktop) ───────────────────────────────────────────────
    canvas.addEventListener('mousemove', (e) => {
      if (this.game.aiMode) return;
      if (this.game._empMode || this.game._towerMode) return;
      if (this.game._awaitingUpgrade) return;
      const rect = canvas.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      this._targetZoneDisplay = { x, y, alpha: 0.45 };
      this.swarm.setTargetZone(x, y);
    });

    // ── Virtual joystick (touch) ─────────────────────────────────────────────
    const DEAD_ZONE  = 15;    // px — no movement inside this radius
    const MAX_RANGE  = 110;   // px — full-speed at this offset
    const CANVAS_W   = canvas.width;
    const CANVAS_H   = canvas.height;

    canvas.addEventListener('touchstart', (e) => {
      if (this.game.aiMode || this.game._awaitingUpgrade) return;
      // Only handle the FIRST touch here; multi-finger is handled by MobileControls
      if (e.touches.length !== 1) { this._joyActive = false; return; }
      e.preventDefault();
      const t   = e.touches[0];
      const rect = canvas.getBoundingClientRect();
      this._joyOriginX = t.clientX - rect.left;
      this._joyOriginY = t.clientY - rect.top;
      this._joyActive  = true;
      // Seed smooth position at origin so there's no jump
      this._mobileRawX    = this._joyOriginX;
      this._mobileRawY    = this._joyOriginY;
      this._mobileSmoothX = this._joyOriginX;
      this._mobileSmoothY = this._joyOriginY;
      this.swarm.setTargetZone(this._joyOriginX, this._joyOriginY);
    }, { passive: false });

    canvas.addEventListener('touchmove', (e) => {
      if (this.game.aiMode) return;
      if (this.game._empMode || this.game._towerMode) return;
      if (!this._joyActive || e.touches.length !== 1) return;
      e.preventDefault();
      const t    = e.touches[0];
      const rect = canvas.getBoundingClientRect();
      const tx   = t.clientX - rect.left;
      const ty   = t.clientY - rect.top;

      // Delta from joystick origin
      const dx = tx - this._joyOriginX;
      const dy = ty - this._joyOriginY;
      const dist = Math.sqrt(dx * dx + dy * dy);

      if (dist < DEAD_ZONE) return;   // inside dead-zone — no movement

      // Exponential acceleration: slow near dead-zone edge, faster beyond
      const active = dist - DEAD_ZONE;
      const ratio  = Math.min(active / (MAX_RANGE - DEAD_ZONE), 1.0);
      const speed  = ratio * ratio;    // quadratic curve

      // Map to canvas world coordinates: move swarm in the direction of drag
      const cx = CANVAS_W / 2, cy = CANVAS_H / 2;
      const angle = Math.atan2(dy, dx);
      const reach = speed * Math.max(CANVAS_W, CANVAS_H) * 0.42;
      const wx = cx + Math.cos(angle) * reach;
      const wy = cy + Math.sin(angle) * reach;

      this._mobileRawX = wx;
      this._mobileRawY = wy;
      // Update joystick puck position for visual (clamped to MAX_RANGE)
      const puckDist = Math.min(dist, MAX_RANGE);
      this._joyPuckX = this._joyOriginX + Math.cos(angle) * puckDist;
      this._joyPuckY = this._joyOriginY + Math.sin(angle) * puckDist;
      this._targetZoneDisplay = { x: wx, y: wy, alpha: 0.55 };
    }, { passive: false });

    canvas.addEventListener('touchend', (e) => {
      if (e.touches.length === 0) {
        this._joyActive  = false;
        this._mobileRawX = null;
        this._joyPuckX   = undefined;
        this._joyPuckY   = undefined;
      }
    }, { passive: true });
  }

  /**
   * Called every frame from Game._update() to lerp the mobile swarm target.
   * Frame-rate independent exponential smoothing.
   */
  updateMobileSmoothing(dt) {
    if (!this._joyActive || this._mobileRawX === null) return;
    const k = 1 - Math.pow(0.04, dt);   // ~12 frames to reach target at 60fps
    this._mobileSmoothX += (this._mobileRawX - this._mobileSmoothX) * k;
    this._mobileSmoothY += (this._mobileRawY - this._mobileSmoothY) * k;
    this.swarm.setTargetZone(this._mobileSmoothX, this._mobileSmoothY);
  }

  _onAIToggle() {
    this.game.toggleAI();
    const on = this.game.aiMode;
    const label = on ? (this.game.agent.statusLabel ?? 'ON') : 'OFF';
    this._aiBtn.innerHTML = `
      <span style="font-size:16px; display:block; line-height:1;">⬡</span>
      <span style="font-size:9px; display:block; opacity:0.7; margin-top:2px; letter-spacing:0.5px;">AI: ${label}</span>
    `;
    this._aiBtn.style.background  = on ? 'rgba(80, 0, 120, 0.9)'    : 'rgba(40, 0, 60, 0.88)';
    this._aiBtn.style.borderColor = on ? 'rgba(204, 136, 255, 0.8)' : 'rgba(204, 136, 255, 0.3)';
    this._aiBtn.style.color       = on ? '#ee99ff' : '#cc88ff';

    if (on) {
      const poll = setInterval(() => {
        const lbl = this.game.agent.statusLabel;
        this._aiBtn.querySelector('span:last-child').textContent = `AI: ${lbl}`;
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

  // Called each frame from Game._update to highlight the recommended formation
  updateRecommendation() {
    if (this.game._deploymentPhase <= 0 && this.game._waveCountdown <= 0) {
      // Not in deployment — clear recommendation glow
      this._buttons.forEach(b => {
        if (!b.dataset.active) b.style.boxShadow = 'none';
      });
      return;
    }
    const enemies = this.game.enemySwarm?.drones ?? [];
    const hasBoss     = enemies.some(e => e.role === 'boss');
    const hasHeavy    = enemies.some(e => e.role === 'sniper' || e.role === 'commander');
    const count       = enemies.length;
    const recommended = hasBoss    ? 'scatter'
                      : hasHeavy   ? 'circle'
                      : count > 12 ? 'wedge'
                      :              'circle';
    this._buttons.forEach(b => {
      if (b.dataset.active) return; // don't override active button
      if (b.dataset.formation === recommended) {
        const pulse = 0.55 + 0.45 * Math.abs(Math.sin(Date.now() / 600));
        b.style.boxShadow = `0 0 ${Math.round(8 + pulse * 8)}px rgba(0, 255, 180, ${(pulse * 0.8).toFixed(2)})`;
        b.style.borderColor = 'rgba(0, 255, 180, 0.75)';
      } else {
        b.style.boxShadow = 'none';
        b.style.borderColor = 'rgba(0, 212, 255, 0.3)';
      }
    });
  }

  _onFormationClick(name, btn) {
    this._buttons.forEach((b) => {
      b.dataset.active = '';
      b.style.background   = 'rgba(0, 20, 40, 0.88)';
      b.style.borderColor  = 'rgba(0, 212, 255, 0.3)';
    });
    btn.dataset.active = '1';
    btn.style.background  = 'rgba(0, 180, 255, 0.28)';
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
    // Use first alive objective for legacy fields
    const primaryObj = g.objectives?.find(o => o.health > 0) ?? g.objectives?.[0];
    return {
      timestamp: Date.now(),
      wave: g.wave,
      score: g.score,
      objectiveHealth: primaryObj?.health ?? 0,
      objectiveX: +(primaryObj?.x?.toFixed(1) ?? 0),
      objectiveY: +(primaryObj?.y?.toFixed(1) ?? 0),
      friendlyCount: g.playerSwarm.drones.length,
      enemyCount: g.enemySwarm.drones.length,
      friendlyDrones: g.playerSwarm.serializeState(),
      enemyDrones: g.enemySwarm.serializeState(),
      currentFormation: g.playerSwarm.currentFormation,
      waveKills: g.waveKills,
      waveLosses: g.waveLosses,
      threatScore: +(g.threatScore().toFixed(3)),
      cityResources: {
        power: +((g.cityResources?.power ?? 100).toFixed(1)),
        water: +((g.cityResources?.water ?? 100).toFixed(1)),
        food:  +((g.cityResources?.food  ?? 100).toFixed(1)),
      },
      enemyRoles: g.enemySwarm.drones.reduce((acc, d) => {
        acc[d.role ?? 'rusher'] = (acc[d.role ?? 'rusher'] ?? 0) + 1;
        return acc;
      }, {}),
    };
  }

  _evaluateOutcome(targetX, targetY) {
    const g = this.game;
    const { drones } = g.playerSwarm;
    const primaryObj = g.objectives?.find(o => o.health > 0) ?? g.objectives?.[0];

    let reached = false;
    if (targetX && drones.length > 0) {
      const cx = drones.reduce((s, d) => s + d.x, 0) / drones.length;
      const cy = drones.reduce((s, d) => s + d.y, 0) / drones.length;
      reached = Math.sqrt((cx - targetX) ** 2 + (cy - targetY) ** 2) < 100;
    }

    return {
      reached,
      kills:           g.waveKills,
      losses:          g.waveLosses,
      threatScore:     +(g.threatScore().toFixed(3)),
      objectiveHealth: primaryObj?.health ?? 0,
      reward: (g.waveKills - g.waveLosses) + (reached ? 1 : -0.5) + (1 - g.threatScore()) * 2,
    };
  }

  drawTargetZone(ctx) {
    // ── Virtual joystick ring (mobile only) ───────────────────────────────────
    if (this._joyActive && this._joyOriginX !== undefined) {
      const ox = this._joyOriginX, oy = this._joyOriginY;
      const px = this._joyPuckX ?? ox, py = this._joyPuckY ?? oy;

      ctx.save();
      // Outer ring
      ctx.globalAlpha = 0.30;
      ctx.strokeStyle = '#00d4ff';
      ctx.lineWidth   = 2;
      ctx.setLineDash([6, 5]);
      ctx.beginPath();
      ctx.arc(ox, oy, 110, 0, Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([]);

      // Dead-zone ring
      ctx.globalAlpha = 0.18;
      ctx.strokeStyle = '#00d4ff';
      ctx.lineWidth   = 1;
      ctx.beginPath();
      ctx.arc(ox, oy, 15, 0, Math.PI * 2);
      ctx.stroke();

      // Puck
      ctx.globalAlpha = 0.55;
      ctx.fillStyle   = '#00d4ff';
      ctx.shadowColor = '#00d4ff';
      ctx.shadowBlur  = 12;
      ctx.beginPath();
      ctx.arc(px, py, 18, 0, Math.PI * 2);
      ctx.fill();
      ctx.shadowBlur = 0;

      // Line from origin to puck
      ctx.globalAlpha = 0.25;
      ctx.strokeStyle = '#00d4ff';
      ctx.lineWidth   = 1.5;
      ctx.beginPath();
      ctx.moveTo(ox, oy);
      ctx.lineTo(px, py);
      ctx.stroke();

      ctx.restore();
      return;   // don't also draw target zone circle on mobile
    }

    // ── Desktop target zone reticle ───────────────────────────────────────────
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
