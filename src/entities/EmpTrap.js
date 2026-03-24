/**
 * EmpTrap — a one-shot EMP mine the player places on the field.
 *
 * States:
 *   armed     — pulsing cyan circle, waiting for an enemy to walk in
 *   triggered — shockwave ring expands, stuns all enemies in radius
 *   dead      — remove from array
 */
export class EmpTrap {
  /** Stun duration applied to enemy drones (seconds) */
  static STUN = 2.8;
  /** Radius that triggers the EMP */
  static RADIUS = 85;
  /** Shockwave stun radius (slightly larger than trigger) */
  static STUN_RADIUS = 120;
  /** Flash animation duration before the trap disappears */
  static FLASH_DUR = 0.65;

  constructor(x, y) {
    this.x = x;
    this.y = y;
    this.state  = 'armed';   // 'armed' | 'triggered'
    this.dead   = false;
    this._pulse = Math.random() * Math.PI * 2;
    this._timer = 0;          // counts down during triggered state
    this._ring  = EmpTrap.RADIUS;   // expanding ring radius
  }

  // ── Update ────────────────────────────────────────────────────────────────

  update(dt, enemies) {
    this._pulse += dt * 2.8;

    if (this.state === 'armed') {
      const r2 = EmpTrap.RADIUS * EmpTrap.RADIUS;
      for (const e of enemies) {
        if (e.dead) continue;
        const dx = e.x - this.x, dy = e.y - this.y;
        if (dx * dx + dy * dy < r2) {
          this._trigger(enemies);
          return;
        }
      }
    } else {
      // triggered — animate ring, then die
      this._timer -= dt;
      this._ring  += dt * 280;
      if (this._timer <= 0) this.dead = true;
    }
  }

  _trigger(enemies) {
    this.state  = 'triggered';
    this._timer = EmpTrap.FLASH_DUR;
    this._ring  = EmpTrap.RADIUS;

    const sr2 = EmpTrap.STUN_RADIUS * EmpTrap.STUN_RADIUS;
    for (const e of enemies) {
      if (e.dead) continue;
      const dx = e.x - this.x, dy = e.y - this.y;
      if (dx * dx + dy * dy < sr2) {
        e._stunTimer = EmpTrap.STUN;
      }
    }
  }

  // ── Draw ──────────────────────────────────────────────────────────────────

  draw(ctx) {
    ctx.save();

    if (this.state === 'armed') {
      this._drawArmed(ctx);
    } else {
      this._drawTriggered(ctx);
    }

    ctx.restore();
  }

  _drawArmed(ctx) {
    const beat = 0.5 + 0.5 * Math.sin(this._pulse);
    const R = EmpTrap.RADIUS;

    // Soft area fill
    const grad = ctx.createRadialGradient(this.x, this.y, 0, this.x, this.y, R);
    grad.addColorStop(0, `rgba(0,220,255,${0.07 + beat * 0.05})`);
    grad.addColorStop(1, 'rgba(0,220,255,0)');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(this.x, this.y, R, 0, Math.PI * 2);
    ctx.fill();

    // Dashed border
    ctx.strokeStyle = `rgba(0,220,255,${0.30 + beat * 0.45})`;
    ctx.lineWidth = 1.5;
    ctx.shadowColor = '#00ddff';
    ctx.shadowBlur  = 6 + beat * 8;
    ctx.setLineDash([5, 7]);
    ctx.beginPath();
    ctx.arc(this.x, this.y, R, 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);

    // Center dot + label
    ctx.shadowBlur = 0;
    ctx.fillStyle = `rgba(0,230,255,${0.55 + beat * 0.35})`;
    ctx.beginPath();
    ctx.arc(this.x, this.y, 4, 0, Math.PI * 2);
    ctx.fill();

    ctx.font = 'bold 9px monospace';
    ctx.textAlign = 'center';
    ctx.fillStyle = `rgba(0,230,255,${0.50 + beat * 0.30})`;
    ctx.fillText('EMP', this.x, this.y - 8);
    ctx.textAlign = 'left';
  }

  _drawTriggered(ctx) {
    const frac = Math.max(0, this._timer / EmpTrap.FLASH_DUR); // 1 → 0
    const R = this._ring;

    // Expanding shockwave ring
    ctx.strokeStyle = `rgba(0,255,255,${frac * 0.95})`;
    ctx.lineWidth   = 2 + 4 * frac;
    ctx.shadowColor = '#00ffff';
    ctx.shadowBlur  = 22 * frac;
    ctx.beginPath();
    ctx.arc(this.x, this.y, R, 0, Math.PI * 2);
    ctx.stroke();

    // Radial fill pulse
    const fg = ctx.createRadialGradient(this.x, this.y, 0, this.x, this.y, R);
    fg.addColorStop(0, `rgba(0,255,255,${frac * 0.22})`);
    fg.addColorStop(0.6, `rgba(0,200,255,${frac * 0.10})`);
    fg.addColorStop(1, 'rgba(0,255,255,0)');
    ctx.fillStyle = fg;
    ctx.beginPath();
    ctx.arc(this.x, this.y, R, 0, Math.PI * 2);
    ctx.fill();
  }
}
