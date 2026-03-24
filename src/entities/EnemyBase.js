/**
 * EnemyBase — the enemy's forward operating base that spawns each wave
 * starting from wave 3.
 *
 * Shield cycle
 *   - SHIELDED  (15 s): invulnerable, blue dome visible
 *   - VULNERABLE (8 s): takes full damage, orange warning ring
 *
 * Two auto-turrets fire at the nearest player drone in range.
 *
 * Destroying the base awards a score bonus and reduces enemies in the
 * next two waves by 20%.
 */

const TWO_PI = Math.PI * 2;

export class EnemyBase {
  constructor(x, y, wave) {
    this.x = x;
    this.y = y;
    this.vx = 0;
    this.vy = 0;

    // Drone-interface fields (so combat code can treat it like a drone)
    this.type = 'enemy';
    this.role = 'base';
    this.dead = false;

    // Combat stubs — base doesn't fire as a generic drone
    this.fireDamage = 0;
    this.fireRange  = 0;
    this.fireRate   = 0;

    // Health scales with wave number
    this.maxHp = 120 + wave * 18;
    this.hp    = this.maxHp;

    // Shield cycle
    this._shielded    = true;
    this._shieldTimer = 15;    // seconds until next phase flip
    this._shieldFlash = 0;     // 0-1, brief visual burst on phase change

    // Two turrets: [ { ox, oy, cooldown } ]
    this._turrets = [
      { ox: -38, oy: 5, cooldown: 0.8 },
      { ox:  38, oy: 5, cooldown: 1.4 },
    ];
    this.TURRET_RANGE  = 190;
    this.TURRET_DAMAGE = 12;
    this.TURRET_RATE   = 0.60;   // shots per second per turret

    // Reward
    this.scoreReward    = 300 + wave * 25;
    this.waveMultReward = 0.80;  // enemy count multiplier next 2 waves

    // Pre-bake rubble points so draw is stable
    this._rubble = Array.from({ length: 8 }, (_, i) => {
      const angle = (i / 8) * TWO_PI + (Math.random() * 0.4 - 0.2);
      const r = 16 + Math.random() * 10;
      return { dx: Math.cos(angle) * r, dy: Math.sin(angle) * r };
    });
  }

  // ── Update ──────────────────────────────────────────────────────────────────

  update(dt) {
    if (this.dead) return;

    // Phase timer
    this._shieldTimer -= dt;
    if (this._shieldTimer <= 0) {
      this._shielded    = !this._shielded;
      this._shieldTimer = this._shielded ? 15 : 8;
      this._shieldFlash = 1;
    }
    if (this._shieldFlash > 0) this._shieldFlash = Math.max(0, this._shieldFlash - dt * 4);

    // Turret cooldowns
    for (const t of this._turrets) {
      if (t.cooldown > 0) t.cooldown -= dt;
    }
  }

  // ── Damage ──────────────────────────────────────────────────────────────────

  /** Returns true when the base is destroyed. */
  takeDamage(amount) {
    if (this._shielded || this.dead) return false;
    this.hp -= amount;
    if (this.hp <= 0) {
      this.hp   = 0;
      this.dead = true;
      return true;
    }
    return false;
  }

  // ── Turret fire ─────────────────────────────────────────────────────────────

  /**
   * Each ready turret picks the nearest player drone in range and fires.
   * Returns an array of shot descriptors for the caller to render / apply.
   * @param {Drone[]} friendlyDrones
   * @returns {{ x1,y1,x2,y2, target, killed }[]}
   */
  shootTurrets(friendlyDrones) {
    if (this.dead) return [];
    const shots = [];
    const r2max = this.TURRET_RANGE * this.TURRET_RANGE;

    for (const t of this._turrets) {
      if (t.cooldown > 0) continue;
      const tx = this.x + t.ox;
      const ty = this.y + t.oy;

      // Nearest living drone in range
      let best = null;
      let bestDist = r2max;
      for (const d of friendlyDrones) {
        if (d.dead) continue;
        const dx = d.x - tx, dy = d.y - ty;
        const d2 = dx * dx + dy * dy;
        if (d2 < bestDist) { bestDist = d2; best = d; }
      }
      if (!best) continue;

      t.cooldown = 1 / this.TURRET_RATE;
      const killed = best.takeDamage(this.TURRET_DAMAGE);
      shots.push({ x1: tx, y1: ty, x2: best.x, y2: best.y, target: best, killed });
    }
    return shots;
  }

  // ── Drone-API stubs ─────────────────────────────────────────────────────────

  findTarget() { return null; }
  tickFire()   { return false; }

  // ── Draw ────────────────────────────────────────────────────────────────────

  draw(ctx) {
    if (this.dead) {
      this._drawRubble(ctx);
      return;
    }

    const t = (Date.now() / 1000);   // wall-clock seconds for animation

    // ── Shield dome ──────────────────────────────────────────────────────────
    if (this._shielded) {
      const pulse = 0.5 + 0.5 * Math.sin(t * Math.PI);
      ctx.save();
      const grad = ctx.createRadialGradient(this.x, this.y, 18, this.x, this.y, 58);
      grad.addColorStop(0, `rgba(0,120,255,${0.08 + 0.04 * pulse})`);
      grad.addColorStop(1, 'rgba(0,60,255,0)');
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(this.x, this.y, 58, 0, TWO_PI);
      ctx.fill();

      ctx.globalAlpha = 0.22 + 0.16 * pulse;
      ctx.strokeStyle = `rgba(80,160,255,0.95)`;
      ctx.lineWidth   = 1.5 + pulse * 0.5;
      ctx.shadowColor = '#0088ff';
      ctx.shadowBlur  = 14;
      ctx.beginPath();
      ctx.arc(this.x, this.y, 54, 0, TWO_PI);
      ctx.stroke();
      ctx.shadowBlur = 0;
      ctx.restore();

      // "SHIELDED" ring text
      ctx.save();
      ctx.globalAlpha = 0.45 + 0.2 * pulse;
      ctx.font = '8px monospace';
      ctx.textAlign = 'center';
      ctx.fillStyle = '#88aaff';
      ctx.fillText('● SHIELDED', this.x, this.y - 40);
      ctx.textAlign = 'left';
      ctx.restore();
    } else {
      // Vulnerable warning pulse
      const warn = 0.5 + 0.5 * Math.sin(t * Math.PI * 3);
      ctx.save();
      ctx.globalAlpha = 0.18 + 0.18 * warn;
      ctx.strokeStyle = '#ff6600';
      ctx.lineWidth   = 2 + warn;
      ctx.shadowColor = '#ff6600';
      ctx.shadowBlur  = 18;
      ctx.beginPath();
      ctx.arc(this.x, this.y, 50, 0, TWO_PI);
      ctx.stroke();
      ctx.shadowBlur = 0;
      ctx.restore();

      ctx.save();
      ctx.globalAlpha = 0.6 + 0.35 * warn;
      ctx.font = 'bold 8px monospace';
      ctx.textAlign = 'center';
      ctx.fillStyle = '#ff9933';
      ctx.shadowColor = '#ff6600';
      ctx.shadowBlur = 6;
      ctx.fillText('▼ VULNERABLE', this.x, this.y - 40);
      ctx.shadowBlur = 0;
      ctx.textAlign = 'left';
      ctx.restore();
    }

    // ── Shield-change flash ──────────────────────────────────────────────────
    if (this._shieldFlash > 0) {
      const col = this._shielded ? '0,100,255' : '255,100,0';
      ctx.save();
      ctx.globalAlpha = this._shieldFlash * 0.5;
      ctx.fillStyle = `rgba(${col},0.9)`;
      ctx.beginPath();
      ctx.arc(this.x, this.y, 64, 0, TWO_PI);
      ctx.fill();
      ctx.restore();
    }

    // ── Hexagonal base body ──────────────────────────────────────────────────
    const hp_frac   = this.hp / this.maxHp;
    const bodyColor = this._shielded ? '#776644' : '#dd6622';

    ctx.save();
    ctx.shadowColor = bodyColor;
    ctx.shadowBlur  = this._shielded ? 6 : 18;

    // Fill
    ctx.fillStyle = 'rgba(30,15,0,0.9)';
    ctx.strokeStyle = bodyColor;
    ctx.lineWidth   = 2;
    ctx.beginPath();
    for (let i = 0; i < 6; i++) {
      const a  = (i / 6) * TWO_PI - Math.PI / 6;
      const r  = 26;
      const px = this.x + Math.cos(a) * r;
      const py = this.y + Math.sin(a) * r;
      if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
    }
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // Inner symbol
    ctx.globalAlpha = 0.5;
    ctx.strokeStyle = bodyColor;
    ctx.lineWidth   = 1;
    ctx.beginPath();
    ctx.arc(this.x, this.y, 10, 0, TWO_PI);
    ctx.stroke();

    ctx.shadowBlur = 0;
    ctx.restore();

    // ── Health bar ───────────────────────────────────────────────────────────
    const bW = 44, bH = 4;
    const bX = this.x - bW / 2, bY = this.y + 34;
    ctx.save();
    ctx.globalAlpha = 0.75;
    ctx.fillStyle = 'rgba(0,0,0,0.5)';
    ctx.fillRect(bX, bY, bW, bH);
    ctx.fillStyle = hp_frac > 0.5 ? '#00ff88'
                  : hp_frac > 0.25 ? '#ffaa00'
                  : '#ff3333';
    ctx.fillRect(bX, bY, bW * hp_frac, bH);
    ctx.restore();

    // ── Turrets ──────────────────────────────────────────────────────────────
    ctx.save();
    for (const turr of this._turrets) {
      const tx = this.x + turr.ox;
      const ty = this.y + turr.oy;
      const ready = turr.cooldown <= 0;
      ctx.fillStyle   = ready ? (this._shielded ? '#888866' : '#ff5500') : '#443322';
      ctx.shadowColor = ctx.fillStyle;
      ctx.shadowBlur  = ready ? 8 : 2;
      ctx.fillRect(tx - 4, ty - 4, 8, 8);
    }
    ctx.shadowBlur = 0;
    ctx.restore();
  }

  _drawRubble(ctx) {
    ctx.save();
    ctx.globalAlpha = 0.28;
    ctx.strokeStyle = '#553300';
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (const pt of this._rubble) {
      ctx.moveTo(this.x + pt.dx * 0.4, this.y + pt.dy * 0.4);
      ctx.lineTo(this.x + pt.dx, this.y + pt.dy);
    }
    ctx.stroke();
    ctx.globalAlpha = 0.15;
    ctx.fillStyle = '#331100';
    ctx.beginPath();
    ctx.arc(this.x, this.y, 20, 0, TWO_PI);
    ctx.fill();
    ctx.restore();
  }
}
