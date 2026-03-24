/**
 * SideMission — optional mid-wave events that appear randomly.
 *
 * Three types:
 *   escort    — protect a slow convoy crossing the map (→ +6 drones)
 *   sabotage  — send a drone to touch a target at the map edge (→ -40% next wave enemies)
 *   holdZone  — keep the swarm centroid inside a zone for 10s (→ +3 drones + 500 score)
 *
 * All missions are OPTIONAL: ignoring them has no penalty.
 * They spawn mid-wave so the player must juggle both.
 */

// ── Shared helpers ─────────────────────────────────────────────────────────

function dist2(ax, ay, bx, by) {
  const dx = ax - bx, dy = ay - by;
  return dx * dx + dy * dy;
}

// ── Escort Mission ─────────────────────────────────────────────────────────

export class EscortMission {
  constructor(canvas) {
    this.type     = 'escort';
    this.complete = false;
    this.failed   = false;
    this.timer    = 35;            // max seconds before mission expires
    this.canvas   = canvas;

    // Convoy travels left → right at mid-screen height
    const y = canvas.height * (0.38 + Math.random() * 0.24);
    this.convoy = { x: -30, y, hp: 100, maxHp: 100, speed: 30 };

    this._pulse = 0;
  }

  /** Call every frame while active */
  update(dt, playerDrones, enemyDrones) {
    if (this.complete || this.failed) return;

    this._pulse += dt * 3;
    this.timer  -= dt;

    const c = this.convoy;

    // Advance convoy
    c.x += c.speed * dt;

    // Convoy takes damage from nearby enemies only when no friendly is covering it
    const covered = playerDrones.some(d => dist2(d.x, d.y, c.x, c.y) < 160 * 160);
    if (!covered) {
      for (const e of enemyDrones) {
        if (dist2(e.x, e.y, c.x, c.y) < 90 * 90) {
          c.hp -= 12 * dt;    // 12 HP/s per uncovered nearby enemy
        }
      }
    }

    if (c.hp <= 0)                     { c.hp = 0;   this.failed   = true; return; }
    if (c.x > this.canvas.width + 40)  {             this.complete = true; return; }
    if (this.timer <= 0)               {             this.failed   = true; }
  }

  draw(ctx) {
    const c = this.convoy;
    if (c.x < -60 || c.x > this.canvas.width + 60) return;

    const pulse  = (Math.sin(this._pulse) + 1) / 2;
    const hpPct  = c.hp / c.maxHp;

    ctx.save();

    // ── Dashed route line ─────────────────────────────────────────────
    ctx.strokeStyle = 'rgba(0,255,136,0.15)';
    ctx.lineWidth   = 1;
    ctx.setLineDash([10, 15]);
    ctx.beginPath();
    ctx.moveTo(c.x, c.y);
    ctx.lineTo(this.canvas.width + 10, c.y);
    ctx.stroke();
    ctx.setLineDash([]);

    // ── Destination flag ─────────────────────────────────────────────
    const destX = this.canvas.width - 16;
    ctx.fillStyle   = `rgba(0,255,136,${0.2 + pulse * 0.3})`;
    ctx.shadowColor = '#00ff88';
    ctx.shadowBlur  = 8 * pulse;
    ctx.beginPath();
    ctx.arc(destX, c.y, 8, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.font       = 'bold 9px monospace';
    ctx.fillStyle  = 'rgba(0,255,136,0.6)';
    ctx.textAlign  = 'center';
    ctx.fillText('DEST', destX, c.y - 14);

    // ── Convoy body ───────────────────────────────────────────────────
    ctx.translate(c.x, c.y);

    // Protective aura (when covered)
    ctx.strokeStyle = `rgba(0,255,136,${0.12 + pulse * 0.08})`;
    ctx.lineWidth   = 1.5;
    ctx.shadowColor = '#00ff88';
    ctx.shadowBlur  = 6;
    ctx.beginPath();
    ctx.arc(0, 0, 160, 0, Math.PI * 2);  // coverage radius hint
    ctx.stroke();
    ctx.shadowBlur = 0;

    // Body: diamond shape in bright green
    ctx.fillStyle   = '#00ff88';
    ctx.shadowColor = '#00ff88';
    ctx.shadowBlur  = 10 + pulse * 6;
    ctx.beginPath();
    ctx.moveTo(16, 0);
    ctx.lineTo(0, -9);
    ctx.lineTo(-14, 0);
    ctx.lineTo(0, 9);
    ctx.closePath();
    ctx.fill();

    // Inner core
    ctx.shadowBlur = 0;
    ctx.fillStyle  = '#ccffe8';
    ctx.beginPath();
    ctx.arc(0, 0, 3.5, 0, Math.PI * 2);
    ctx.fill();

    // Label
    ctx.font      = 'bold 9px monospace';
    ctx.fillStyle = 'rgba(0,255,136,0.85)';
    ctx.textAlign = 'center';
    ctx.fillText('CONVOY', 0, -17);

    // HP bar
    const bw = 36, bh = 3;
    ctx.fillStyle = 'rgba(0,0,0,0.5)';
    ctx.fillRect(-bw / 2, 14, bw, bh);
    const barColor = hpPct > 0.5 ? '#00ff88' : hpPct > 0.25 ? '#ffcc00' : '#ff4444';
    ctx.fillStyle  = barColor;
    ctx.fillRect(-bw / 2, 14, bw * hpPct, bh);

    ctx.restore();
  }

  get statusText() {
    const pct = Math.round((this.convoy.x / this.canvas.width) * 100);
    return `🚁 حماية الرتل ${Math.max(0, pct)}% · HP ${Math.ceil(this.convoy.hp)} · ${Math.ceil(this.timer)}s`;
  }

  get reward() { return { drones: 6, score: 300, nextWaveEnemyMult: 1.0 }; }
}

// ── Sabotage Mission ───────────────────────────────────────────────────────

export class SabotageMission {
  constructor(canvas) {
    this.type     = 'sabotage';
    this.complete = false;
    this.failed   = false;
    this.timer    = 22;
    this.canvas   = canvas;

    // Target appears on a random edge (simulates enemy relay station)
    const edges = ['top', 'left', 'right'];  // not bottom (where player spawns)
    const edge  = edges[Math.floor(Math.random() * edges.length)];
    const cx = canvas.width, cy = canvas.height;
    switch (edge) {
      case 'top':
        this.target = { x: cx * (0.25 + Math.random() * 0.50), y: 40 };   break;
      case 'left':
        this.target = { x: 40, y: cy * (0.20 + Math.random() * 0.60) };   break;
      default: // right
        this.target = { x: cx - 40, y: cy * (0.20 + Math.random() * 0.60) }; break;
    }

    this._pulse = 0;
  }

  update(dt, playerDrones) {
    if (this.complete || this.failed) return;

    this._pulse += dt * 4;
    this.timer  -= dt;

    // Success if any friendly drone reaches within 45px
    const reached = playerDrones.some(d => dist2(d.x, d.y, this.target.x, this.target.y) < 45 * 45);
    if (reached) { this.complete = true; return; }
    if (this.timer <= 0) { this.failed = true; }
  }

  draw(ctx) {
    const t      = this.target;
    const pulse  = (Math.sin(this._pulse) + 1) / 2;
    const urgency = 1 - this.timer / 22;   // 0→1 as time runs out

    ctx.save();

    // Outer danger ring (grows with urgency)
    for (let r = 0; r < 3; r++) {
      const ringR  = 28 + r * 14 + pulse * 8;
      const alpha  = (0.25 - r * 0.07) * (1 - pulse * 0.4);
      ctx.strokeStyle = `rgba(255,80,0,${alpha})`;
      ctx.lineWidth   = 1.2;
      ctx.shadowColor = '#ff4400';
      ctx.shadowBlur  = 6;
      ctx.beginPath();
      ctx.arc(t.x, t.y, ringR, 0, Math.PI * 2);
      ctx.stroke();
    }

    // Center target
    ctx.fillStyle   = `rgba(255,${Math.round(80 - urgency * 80)},0,${0.7 + pulse * 0.3})`;
    ctx.shadowBlur  = 14 + urgency * 10;
    ctx.beginPath();
    ctx.arc(t.x, t.y, 10 + urgency * 4, 0, Math.PI * 2);
    ctx.fill();

    // Cross-hair lines
    ctx.strokeStyle = `rgba(255,80,0,0.65)`;
    ctx.lineWidth   = 1.5;
    ctx.shadowBlur  = 6;
    ctx.beginPath();
    ctx.moveTo(t.x - 20, t.y); ctx.lineTo(t.x + 20, t.y);
    ctx.moveTo(t.x, t.y - 20); ctx.lineTo(t.x, t.y + 20);
    ctx.stroke();

    // Label
    ctx.shadowBlur = 0;
    ctx.font       = 'bold 9px monospace';
    ctx.fillStyle  = 'rgba(255,100,0,0.9)';
    ctx.textAlign  = 'center';
    ctx.fillText('TARGET', t.x, t.y - 22);
    ctx.fillText(`${Math.ceil(this.timer)}s`, t.x, t.y + 24);

    ctx.restore();
  }

  get statusText() {
    return `💣 تخريب القاعدة · أرسل درون! · ${Math.ceil(this.timer)}s`;
  }

  get reward() { return { drones: 0, score: 250, nextWaveEnemyMult: 0.58 }; }
}

// ── Hold Zone Mission ──────────────────────────────────────────────────────

export class HoldZoneMission {
  constructor(canvas, objectives) {
    this.type     = 'holdZone';
    this.complete = false;
    this.failed   = false;
    this.timer    = 30;          // total window
    this.holdRequired  = 10;    // seconds of continuous hold needed
    this.holdProgress  = 0;
    this.radius   = 72;
    this._pulse   = 0;

    // Place zone away from objectives and HUD area
    const tries = 20;
    let zx = 0, zy = 0;
    for (let i = 0; i < tries; i++) {
      zx = canvas.width  * (0.25 + Math.random() * 0.50);
      zy = canvas.height * (0.30 + Math.random() * 0.40);
      const tooClose = (objectives ?? []).some(o => dist2(zx, zy, o.x, o.y) < 130 * 130);
      if (!tooClose) break;
    }
    this.zone = { x: zx, y: zy };
  }

  update(dt, playerDrones) {
    if (this.complete || this.failed) return;

    this._pulse  += dt * 2;
    this.timer   -= dt;

    // Check if swarm centroid is inside zone
    const alive = playerDrones.filter(d => !d.dead);
    if (alive.length) {
      const cx = alive.reduce((s, d) => s + d.x, 0) / alive.length;
      const cy = alive.reduce((s, d) => s + d.y, 0) / alive.length;
      const inside = dist2(cx, cy, this.zone.x, this.zone.y) < this.radius * this.radius;
      if (inside) {
        this.holdProgress = Math.min(this.holdRequired, this.holdProgress + dt);
      } else {
        this.holdProgress = Math.max(0, this.holdProgress - dt * 0.8);  // slow drain
      }
    }

    if (this.holdProgress >= this.holdRequired) { this.complete = true; return; }
    if (this.timer <= 0) { this.failed = true; }
  }

  draw(ctx) {
    const z       = this.zone;
    const pct     = this.holdProgress / this.holdRequired;
    const pulse   = (Math.sin(this._pulse) + 1) / 2;
    const urgency = 1 - this.timer / 30;

    ctx.save();
    ctx.translate(z.x, z.y);

    // Fill
    ctx.fillStyle = `rgba(0,255,136,${0.04 + pct * 0.09 + pulse * 0.02})`;
    ctx.beginPath();
    ctx.arc(0, 0, this.radius, 0, Math.PI * 2);
    ctx.fill();

    // Outer ring
    ctx.strokeStyle = `rgba(0,255,136,${0.20 + pct * 0.40 + pulse * 0.10})`;
    ctx.lineWidth   = 1.5 + pct * 2;
    ctx.shadowColor = '#00ff88';
    ctx.shadowBlur  = 6 + pct * 12;
    ctx.beginPath();
    ctx.arc(0, 0, this.radius, 0, Math.PI * 2);
    ctx.stroke();
    ctx.shadowBlur = 0;

    // Progress arc (fills clockwise)
    if (pct > 0) {
      ctx.strokeStyle = '#00ff88';
      ctx.lineWidth   = 4;
      ctx.shadowColor = '#00ff88';
      ctx.shadowBlur  = 16;
      ctx.lineCap     = 'round';
      ctx.beginPath();
      ctx.arc(0, 0, this.radius - 6, -Math.PI / 2, -Math.PI / 2 + pct * Math.PI * 2);
      ctx.stroke();
      ctx.shadowBlur = 0;
    }

    // Dashed inner guide ring
    ctx.strokeStyle = `rgba(0,255,136,0.12)`;
    ctx.lineWidth   = 1;
    ctx.setLineDash([6, 8]);
    ctx.beginPath();
    ctx.arc(0, 0, this.radius - 16, 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);

    // Center text
    ctx.font      = `bold ${10 + pct * 2}px monospace`;
    ctx.fillStyle = `rgba(0,255,136,${0.55 + pulse * 0.25})`;
    ctx.textAlign = 'center';
    ctx.fillText('HOLD', 0, -6);
    ctx.font      = '10px monospace';
    ctx.fillStyle = `rgba(0,255,136,${0.5 + pulse * 0.2})`;
    ctx.fillText(`${Math.ceil(this.holdRequired - this.holdProgress)}s`, 0, 9);

    ctx.restore();
  }

  get statusText() {
    const pct = Math.round((this.holdProgress / this.holdRequired) * 100);
    return `🎯 احتل المنطقة · ${pct}% · ${Math.ceil(this.timer)}s متبقي`;
  }

  get reward() { return { drones: 3, score: 500, nextWaveEnemyMult: 1.0 }; }
}

// ── Factory ────────────────────────────────────────────────────────────────

const MISSION_LABELS = {
  escort:   '🚁 مهمة: حماية الرتل! (+6 طائرات)',
  sabotage: '💣 مهمة: دمّر القاعدة! (-42% أعداء)',
  holdZone: '🎯 مهمة: احتل المنطقة! (+3 طائرات)',
};

/**
 * Returns a new SideMission instance (randomly chosen), or null if conditions aren't met.
 * @param {number}   wave
 * @param {object}   canvas
 * @param {object[]} objectives
 */
export function generateSideMission(wave, canvas, objectives) {
  const pool = ['escort', 'holdZone'];
  if (wave >= 3) pool.push('sabotage');

  const type = pool[Math.floor(Math.random() * pool.length)];
  switch (type) {
    case 'escort':   return { mission: new EscortMission(canvas),               label: MISSION_LABELS.escort   };
    case 'sabotage': return { mission: new SabotageMission(canvas),             label: MISSION_LABELS.sabotage };
    default:         return { mission: new HoldZoneMission(canvas, objectives), label: MISSION_LABELS.holdZone };
  }
}
