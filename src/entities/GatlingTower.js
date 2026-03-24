/**
 * GatlingTower — a player-placed defensive turret.
 *
 * Stats:
 *   HP      200   — destroyed by enemy pressure fire
 *   Range   160px — scan/fire radius
 *   Damage   18   — per shot
 *   Rate    0.20s — ~5 shots/sec (Gatling feel)
 *   Cost    150   — score points deducted on placement
 *
 * update(dt, enemies) returns null or { x1,y1,x2,y2, killed, target }
 * so Game.js can feed it into the laser/kill pipeline.
 */
export class GatlingTower {
  static COST        = 150;
  static RANGE       = 160;
  static HP          = 200;
  static DAMAGE      = 18;
  static RATE        = 0.20;
  static BASE_HALF   = 13;   // half-size of the square base
  static PRESSURE_R  = 90;   // radius in which enemies deal DPS to tower
  static PRESSURE_DPS = 12;  // DPS per enemy in that radius
  static FLASH_DUR   = 0.07;

  constructor(x, y) {
    this.x      = x;
    this.y      = y;
    this.hp     = GatlingTower.HP;
    this.maxHp  = GatlingTower.HP;
    this.dead   = false;

    this._angle      = -Math.PI / 2;  // barrel starts pointing up
    this._fireTimer  = GatlingTower.RATE * Math.random();  // staggered
    this._flash      = 0;             // muzzle-flash countdown
    this._pulse      = Math.random() * Math.PI * 2;
    this._heatBar    = 0;             // 0-1 heat indicator (cosmetic)
  }

  // ── Update ────────────────────────────────────────────────────────────────

  /**
   * @param {number} dt
   * @param {object[]} enemies  — EnemySwarm.drones array
   * @returns {{ x1,y1,x2,y2, killed:bool, target:object }|null}
   */
  update(dt, enemies) {
    this._pulse += dt * 2.2;
    if (this._flash  > 0) this._flash  -= dt;
    if (this._heatBar > 0) this._heatBar = Math.max(0, this._heatBar - dt * 0.8);

    // ── Pressure damage from nearby enemies ───────────────────────────────
    const pr2 = GatlingTower.PRESSURE_R * GatlingTower.PRESSURE_R;
    let totalDps = 0;
    for (const e of enemies) {
      if (e.dead) continue;
      const dx = e.x - this.x, dy = e.y - this.y;
      if (dx * dx + dy * dy < pr2) totalDps += GatlingTower.PRESSURE_DPS;
    }
    if (totalDps > 0) {
      this.hp -= totalDps * dt;
      if (this.hp <= 0) { this.hp = 0; this.dead = true; return null; }
    }

    // ── Find nearest enemy in range ────────────────────────────────────────
    let nearest = null;
    let minD2   = GatlingTower.RANGE * GatlingTower.RANGE;
    for (const e of enemies) {
      if (e.dead || (e._stunTimer ?? 0) > 0) continue;
      const dx = e.x - this.x, dy = e.y - this.y;
      const d2 = dx * dx + dy * dy;
      if (d2 < minD2) { minD2 = d2; nearest = e; }
    }

    if (!nearest) return null;

    // Rotate barrel toward target
    this._angle = Math.atan2(nearest.y - this.y, nearest.x - this.x);

    // Fire
    this._fireTimer -= dt;
    if (this._fireTimer > 0) return null;
    this._fireTimer = GatlingTower.RATE;
    this._flash     = GatlingTower.FLASH_DUR;
    this._heatBar   = Math.min(1, this._heatBar + 0.22);

    const killed = nearest.takeDamage(GatlingTower.DAMAGE);
    return { x1: this.x, y1: this.y, x2: nearest.x, y2: nearest.y,
             killed, target: nearest };
  }

  // ── Draw ──────────────────────────────────────────────────────────────────

  draw(ctx, ghost = false) {
    const S = GatlingTower.BASE_HALF;
    const hpFrac   = this.hp / this.maxHp;
    const baseColor = hpFrac > 0.60 ? '#ffcc00'
                    : hpFrac > 0.30 ? '#ff8800'
                    : '#ff3333';
    const beat = 0.5 + 0.5 * Math.sin(this._pulse);

    ctx.save();
    if (ghost) ctx.globalAlpha = 0.45;

    // ── Range ring ────────────────────────────────────────────────────────
    if (!ghost) {
      ctx.strokeStyle = `rgba(255,180,0,${0.05 + beat * 0.04})`;
      ctx.lineWidth = 1;
      ctx.setLineDash([3, 9]);
      ctx.beginPath();
      ctx.arc(this.x, this.y, GatlingTower.RANGE, 0, Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([]);
    } else {
      // Ghost: show full range ring so player knows coverage
      ctx.strokeStyle = 'rgba(255,200,0,0.30)';
      ctx.lineWidth = 1;
      ctx.setLineDash([4, 6]);
      ctx.beginPath();
      ctx.arc(this.x, this.y, GatlingTower.RANGE, 0, Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([]);
    }

    ctx.translate(this.x, this.y);

    // ── Base platform ─────────────────────────────────────────────────────
    ctx.fillStyle   = 'rgba(15,25,35,0.90)';
    ctx.strokeStyle = baseColor;
    ctx.lineWidth   = 1.5;
    ctx.shadowColor = baseColor;
    ctx.shadowBlur  = ghost ? 0 : 5 + beat * 4;
    ctx.beginPath();
    ctx.rect(-S, -S, S * 2, S * 2);
    ctx.fill();
    ctx.stroke();
    ctx.shadowBlur = 0;

    // Cross-brace detail
    ctx.strokeStyle = `rgba(255,200,0,0.20)`;
    ctx.lineWidth   = 0.8;
    ctx.beginPath();
    ctx.moveTo(-S + 3, -S + 3); ctx.lineTo(S - 3, S - 3);
    ctx.moveTo(S - 3,  -S + 3); ctx.lineTo(-S + 3, S - 3);
    ctx.stroke();

    // ── Heat bar (cosmetic, top of base) ─────────────────────────────────
    if (!ghost && this._heatBar > 0) {
      const bw = S * 2 - 4, bh = 2;
      ctx.fillStyle = 'rgba(0,0,0,0.5)';
      ctx.fillRect(-S + 2, -S - 5, bw, bh);
      const heatColor = this._heatBar > 0.7 ? '#ff4400' : '#ffaa00';
      ctx.fillStyle = heatColor;
      ctx.fillRect(-S + 2, -S - 5, Math.round(bw * this._heatBar), bh);
    }

    // ── Turret body ───────────────────────────────────────────────────────
    ctx.fillStyle   = 'rgba(25,35,45,0.95)';
    ctx.strokeStyle = baseColor;
    ctx.lineWidth   = 1.5;
    ctx.shadowColor = baseColor;
    ctx.shadowBlur  = ghost ? 0 : 4;
    ctx.beginPath();
    ctx.arc(0, 0, 8, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.shadowBlur = 0;

    // ── Barrel (rotates) ──────────────────────────────────────────────────
    ctx.rotate(this._angle);

    const flashFrac = this._flash / GatlingTower.FLASH_DUR;
    const barColor  = this._flash > 0
      ? `rgba(255,220,100,${0.7 + flashFrac * 0.3})`
      : baseColor;

    ctx.fillStyle   = barColor;
    ctx.shadowColor = '#ffcc00';
    ctx.shadowBlur  = this._flash > 0 ? 12 + flashFrac * 8 : 0;

    // Barrel body (two parallel rails + central shaft)
    ctx.fillRect(6,  -1.5, 20,  3);    // top rail
    ctx.fillRect(6,   3.5, 20,  3);    // bottom rail
    ctx.fillStyle = this._flash > 0 ? barColor : `rgba(255,180,0,0.55)`;
    ctx.fillRect(6,   1,   20,  2);    // central shaft (dimmer)
    ctx.fillStyle = barColor;
    ctx.fillRect(24, -2,    3,  4);    // muzzle block

    // Muzzle flash
    if (this._flash > 0) {
      ctx.fillStyle = `rgba(255,255,160,${flashFrac * 0.90})`;
      ctx.beginPath();
      ctx.arc(28, 0, 4 + flashFrac * 5, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.restore();

    // ── HP bar (above base, only when damaged) ────────────────────────────
    if (!ghost && this.hp < this.maxHp) {
      const bw = S * 2 + 6, bh = 3;
      const bx = this.x - bw / 2;
      const by = this.y - S - 9;
      ctx.fillStyle = 'rgba(0,0,0,0.65)';
      ctx.fillRect(bx, by, bw, bh);
      ctx.fillStyle = baseColor;
      ctx.fillRect(bx, by, Math.round(bw * hpFrac), bh);
    }
  }
}
