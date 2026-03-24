/**
 * RadarSweep — rotating radar sweep line with blip persistence.
 *
 * How it works:
 *   - A sweep line rotates 360° every ~7 seconds (clockwise from North).
 *   - When the line crosses an entity, it records the entity's position
 *     as a "blip" (ghost image).  The blip fades over ~7 seconds — so
 *     between sweeps, you see where enemies *were*, not where they are.
 *   - On first detection, a brief expanding ring "ping" fires from the blip.
 *
 * The result: between sweeps, you must predict enemy movement from the
 * fading echoes — adding genuine tactical tension.
 */

const TWO_PI    = Math.PI * 2;
const BLIP_LIFE = 7.5;   // seconds ≈ one full rotation
const PING_LIFE = 0.55;  // seconds for ping ring

export class RadarSweep {
  constructor() {
    this.angle  = -Math.PI / 2;  // start pointing North (up)
    this.speed  = TWO_PI / 7;    // full rotation every 7 s
    this._blips = new Map();     // entity → { x, y, age, color, size }
    this._pings = [];            // { x, y, age, color }
  }

  /**
   * @param {number}   dt
   * @param {number}   cx   canvas centre x
   * @param {number}   cy   canvas centre y
   * @param {object[]} entities  — all drones (friendly + enemy)
   */
  update(dt, cx, cy, entities) {
    const prev = this.angle;
    this.angle += this.speed * dt;
    // Keep angle in roughly [-π, π] range (avoids slow drift)
    if (this.angle > Math.PI * 1.5) this.angle -= TWO_PI;

    // ── Detect entities swept this frame ──────────────────────────────
    for (const e of entities) {
      if (e.dead) continue;
      const ea = Math.atan2(e.y - cy, e.x - cx);
      if (!this._swept(prev, this.angle, ea)) continue;

      // Stealth drones not shown on radar until revealed by proximity
      if (e.role === 'stealth' && !e._revealed) continue;

      // Determine blip appearance
      const isEnemy    = e.type === 'enemy';
      const color      = isEnemy ? '#ff4444' : (e._teamColor ?? '#00ccff');
      const shape      = isEnemy ? 'circle'  : (e._radarShape ?? 'circle');
      const size       = (e._isBoss || e.role === 'boss' || e.role === 'commander') ? 6.0
                       : e.role === 'kamikaze' ? 4.5
                       : 3.5;
      const vet        = e._vet ?? 0;

      const alreadyKnown = this._blips.has(e);
      this._blips.set(e, { x: e.x, y: e.y, age: 0, color, shape, size, vet });

      // Ping flash only on first detection of a new contact
      if (!alreadyKnown) {
        this._pings.push({ x: e.x, y: e.y, age: 0, color });
      }
    }

    // ── Age blips ─────────────────────────────────────────────────────
    for (const [key, b] of this._blips) {
      b.age += dt;
      if (b.age > BLIP_LIFE) this._blips.delete(key);
    }

    // ── Age pings ─────────────────────────────────────────────────────
    this._pings = this._pings.filter(p => { p.age += dt; return p.age < PING_LIFE; });
  }

  /**
   * Returns true if the sweep arm moved from prevAngle to currAngle
   * (clockwise) and crossed entityAngle in that arc.
   */
  _swept(prev, curr, entityAngle) {
    const n = a => ((a % TWO_PI) + TWO_PI) % TWO_PI;
    const p = n(prev), c = n(curr), e = n(entityAngle);
    if (p <= c) return e >= p && e <= c;
    return e >= p || e <= c;   // arc wraps through 0
  }

  /**
   * @param {CanvasRenderingContext2D} ctx
   * @param {number} cx  canvas centre x
   * @param {number} cy  canvas centre y
   * @param {number} W   canvas width
   * @param {number} H   canvas height
   */
  draw(ctx, cx, cy, W, H) {
    ctx.save();
    const maxR      = Math.sqrt(W * W + H * H) / 2 + 40;
    const TRAIL_ARC = Math.PI * 0.28;  // ~50° trailing glow

    // ── Sweep trail ───────────────────────────────────────────────────
    // Render as 24 overlapping arc sectors, brightest near line tip
    const STEPS = 24;
    for (let i = 0; i < STEPS; i++) {
      const t1 = (i + 1) / STEPS;
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.arc(cx, cy,
        maxR,
        this.angle - TRAIL_ARC * (1 - i / STEPS),
        this.angle - TRAIL_ARC * (1 - t1)
      );
      ctx.closePath();
      ctx.fillStyle = `rgba(0,255,100,${0.065 * t1 * t1 * t1})`;
      ctx.fill();
    }

    // ── Sweep line ────────────────────────────────────────────────────
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.lineTo(
      cx + Math.cos(this.angle) * maxR,
      cy + Math.sin(this.angle) * maxR
    );
    ctx.strokeStyle = 'rgba(0,255,110,0.92)';
    ctx.lineWidth   = 1.5;
    ctx.shadowColor = '#00ff88';
    ctx.shadowBlur  = 14;
    ctx.stroke();
    ctx.shadowBlur = 0;

    // ── Blips (fading ghost echoes) ───────────────────────────────────
    for (const [, b] of this._blips) {
      const decay = 1 - b.age / BLIP_LIFE;
      const alpha = Math.pow(decay, 1.7);
      const r     = b.size * (0.55 + 0.45 * decay);

      ctx.globalAlpha = alpha;
      ctx.fillStyle   = b.color;
      ctx.shadowColor = b.color;
      ctx.shadowBlur  = 10 * decay;
      this._drawShape(ctx, b.x, b.y, r, b.shape ?? 'circle');

      // Veteran rings
      if (b.vet >= 1) {
        ctx.shadowBlur  = 8 * decay;
        ctx.strokeStyle = b.vet >= 2 ? '#ffffff' : '#ffcc00';
        ctx.shadowColor = b.vet >= 2 ? '#ffffff' : '#ffcc00';
        ctx.lineWidth   = b.vet >= 2 ? 1.5 : 1.2;
        ctx.fillStyle   = 'transparent';
        ctx.beginPath();
        ctx.arc(b.x, b.y, r + 4, 0, TWO_PI);
        ctx.stroke();
      }
    }

    // ── Ping flashes (expanding ring on new contact) ───────────────────
    ctx.globalAlpha = 1;
    ctx.shadowBlur  = 0;

    for (const p of this._pings) {
      const t     = p.age / PING_LIFE;
      const alpha = (1 - t) * 0.85;
      const r     = 3 + t * 24;

      ctx.globalAlpha = alpha;
      ctx.strokeStyle = p.color;
      ctx.shadowColor = p.color;
      ctx.shadowBlur  = 9;
      ctx.lineWidth   = 1.5;
      ctx.beginPath();
      ctx.arc(p.x, p.y, r, 0, TWO_PI);
      ctx.stroke();
    }

    ctx.globalAlpha = 1;
    ctx.shadowBlur  = 0;
    ctx.restore();
  }

  /**
   * Draw a blip shape at (x, y) with radius r.
   * shape: 'circle' | 'diamond' | 'triangle' | 'cross'
   */
  _drawShape(ctx, x, y, r, shape) {
    if (shape === 'cross') {
      const w = r * 0.65;
      ctx.fillRect(x - w / 2, y - r * 1.3, w, r * 2.6);
      ctx.fillRect(x - r * 1.3, y - w / 2, r * 2.6, w);
      return;
    }
    ctx.beginPath();
    switch (shape) {
      case 'diamond':
        ctx.moveTo(x,         y - r * 1.4);
        ctx.lineTo(x + r,     y);
        ctx.lineTo(x,         y + r * 1.4);
        ctx.lineTo(x - r,     y);
        ctx.closePath();
        break;
      case 'triangle':
        ctx.moveTo(x,           y - r * 1.3);
        ctx.lineTo(x + r * 1.1, y + r * 0.8);
        ctx.lineTo(x - r * 1.1, y + r * 0.8);
        ctx.closePath();
        break;
      default: // circle
        ctx.arc(x, y, r, 0, TWO_PI);
    }
    ctx.fill();
  }
}
