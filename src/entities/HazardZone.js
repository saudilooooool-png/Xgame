/**
 * HazardZone — a pulsing damage area on the map
 *
 * Drones (friendly + enemy) that enter the radius take damage over time.
 * Zones are randomised per wave and avoided only if the AI/player steers clear.
 */
export class HazardZone {
  constructor(x, y, radius, dps) {
    this.x = x;
    this.y = y;
    this.radius = radius;
    this.dps = dps;          // damage per second while inside
    this._pulse = Math.random() * Math.PI * 2;
  }

  /** Apply per-frame damage to any drone inside the zone. */
  applyDamage(drones, dt, dpsMultiplier = 1) {
    const r2 = this.radius * this.radius;
    const dps = this.dps * dpsMultiplier;
    for (const d of drones) {
      const dx = d.x - this.x, dy = d.y - this.y;
      if (dx * dx + dy * dy < r2) {
        d.hp -= dps * dt;
        if (d.hp <= 0) { d.hp = 0; d.dead = true; }
      }
    }
  }

  draw(ctx) {
    this._pulse += 0.05;
    const beat = 0.5 + 0.5 * Math.sin(this._pulse);   // 0–1
    const r = this.radius + beat * 6;

    ctx.save();

    // filled area — low alpha
    const grad = ctx.createRadialGradient(this.x, this.y, 0, this.x, this.y, r);
    grad.addColorStop(0, `rgba(255,40,0,${0.12 + beat * 0.06})`);
    grad.addColorStop(1, 'rgba(255,40,0,0)');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(this.x, this.y, r, 0, Math.PI * 2);
    ctx.fill();

    // pulsing border
    ctx.strokeStyle = `rgba(255,80,0,${0.4 + beat * 0.5})`;
    ctx.lineWidth = 1.5;
    ctx.shadowColor = '#ff5500';
    ctx.shadowBlur = 8 + beat * 6;
    ctx.setLineDash([6, 5]);
    ctx.beginPath();
    ctx.arc(this.x, this.y, r, 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);

    // warning label
    ctx.fillStyle = `rgba(255,120,0,${0.55 + beat * 0.3})`;
    ctx.font = 'bold 10px monospace';
    ctx.textAlign = 'center';
    ctx.shadowBlur = 0;
    ctx.fillText('HAZARD', this.x, this.y + 4);
    ctx.textAlign = 'left';

    ctx.restore();
  }

  /** Serialize for DataCollector */
  serialize() {
    return { x: +(this.x.toFixed(1)), y: +(this.y.toFixed(1)), radius: this.radius };
  }
}

/**
 * Generate 0-3 non-overlapping hazard zones for a wave.
 * Avoids spawning on top of any city objective or canvas edges.
 * @param {number} wave
 * @param {number} canvasWidth
 * @param {number} canvasHeight
 * @param {Objective[]|{x,y}[]} objectives - array of objectives to avoid
 */
export function generateHazards(wave, canvasWidth, canvasHeight, objectives) {
  if (wave < 3) return [];
  const count = wave < 5 ? 1 : wave < 8 ? 2 : 3;
  const MARGIN = 80;
  const OBJ_CLEAR = 130;
  const MIN_GAP = 120;
  const zones = [];

  // Normalise: accept both Objective instances and plain {x,y} objects
  const objPoints = Array.isArray(objectives)
    ? objectives
    : [{ x: objectives, y: arguments[4] }]; // legacy single-xy fallback

  let attempts = 0;
  while (zones.length < count && attempts < 80) {
    attempts++;
    const r = 55 + Math.random() * 35;
    const x = MARGIN + Math.random() * (canvasWidth  - MARGIN * 2);
    const y = MARGIN + Math.random() * (canvasHeight - MARGIN * 2);

    // Stay away from all objectives
    const tooCloseToObj = objPoints.some(obj => {
      const d = Math.sqrt((x - obj.x) ** 2 + (y - obj.y) ** 2);
      return d < OBJ_CLEAR + r;
    });
    if (tooCloseToObj) continue;

    // Don't overlap other zones
    const overlaps = zones.some((z) => {
      const d = Math.sqrt((x - z.x) ** 2 + (y - z.y) ** 2);
      return d < z.radius + r + MIN_GAP;
    });
    if (overlaps) continue;

    zones.push(new HazardZone(x, y, r, 18 + wave * 2));
  }

  return zones;
}
