import { Drone } from './Drone.js';
import { computeBoidForce } from '../ai/Boids.js';
import { ENEMY_ROLES, waveComposition } from './EnemyRoles.js';

export class EnemySwarm {
  constructor(count, canvas, objective) {
    this.canvas = canvas;
    this.objective = objective;
    this.drones = [];
    this.spawning = false;
    if (count > 0) this.spawnWave(1, count);
  }

  spawnWave(wave, overrideCount) {
    this.spawning = true;
    const count = overrideCount ?? Math.min(10 + wave * 3, 40);
    const { width, height } = this.canvas;
    const edges = ['top', 'left', 'right', 'bottom'];
    const roles = waveComposition(wave, count);

    for (let i = 0; i < count; i++) {
      const edge = edges[Math.floor(Math.random() * edges.length)];
      let x, y;
      if (edge === 'top')         { x = Math.random() * width;  y = -20; }
      else if (edge === 'bottom') { x = Math.random() * width;  y = height + 20; }
      else if (edge === 'left')   { x = -20;                    y = Math.random() * height; }
      else                        { x = width + 20;             y = Math.random() * height; }

      const role = roles[i];
      const cfg  = ENEMY_ROLES[role];
      const drone = new Drone(x, y, 'enemy');

      // Apply role stats
      drone.role       = role;
      drone.hp         = cfg.hp;
      drone.maxHp      = cfg.maxHp;
      drone.maxSpeed   = cfg.maxSpeed;
      drone.fireRange  = cfg.fireRange;
      drone.fireDamage = cfg.fireDamage;
      drone.fireRate   = cfg.fireRate;
      drone._fireTimer = Math.random() * cfg.fireRate;
      drone._roleColor = cfg.color;
      drone._roleShadow = cfg.shadowColor;

      this.drones.push(drone);
    }
    this.spawning = false;
  }

  update(dt, friendlyDrones) {
    const friendly = friendlyDrones;

    for (const drone of this.drones) {
      const cfg = ENEMY_ROLES[drone.role ?? 'rusher'];
      let seekTarget;

      switch (drone.role) {
        case 'flanker':
          seekTarget = this._flankerTarget(drone, friendly);
          break;
        case 'sniper':
          seekTarget = this._sniperTarget(drone, friendly);
          break;
        default: // rusher
          seekTarget = this.objective;
          break;
      }

      // Occasionally retarget
      if (Math.random() < 0.003) drone.target = seekTarget;
      else if (!drone.target)    drone.target = seekTarget;

      const force = computeBoidForce(drone, this.drones, drone.target, cfg.boids);
      drone.update(dt, force);
      this._clampToBounds(drone);
    }
  }

  // ── Role-specific target calculations ─────────────────────────────────────

  /** Flanker: seeks a point 180° around the friendly centroid */
  _flankerTarget(drone, friendly) {
    if (!friendly.length) return this.objective;

    // friendly centroid
    const fcx = friendly.reduce((s, d) => s + d.x, 0) / friendly.length;
    const fcy = friendly.reduce((s, d) => s + d.y, 0) / friendly.length;

    // vector from friendly centroid → objective
    const toObjX = this.objective.x - fcx;
    const toObjY = this.objective.y - fcy;
    const len = Math.sqrt(toObjX * toObjX + toObjY * toObjY) || 1;

    // go 90° offset to approach from the flank
    const perp = drone._flankSign ?? (drone._flankSign = Math.random() < 0.5 ? 1 : -1);
    return {
      x: this.objective.x + (-toObjY / len) * 120 * perp,
      y: this.objective.y + ( toObjX / len) * 120 * perp,
    };
  }

  /** Sniper: stays 160-220px away from nearest friendly, retreats if too close */
  _sniperTarget(drone, friendly) {
    if (!friendly.length) return this.objective;

    const IDEAL_DIST = 185;
    let nearestF = null, minD2 = Infinity;
    for (const f of friendly) {
      const dx = f.x - drone.x, dy = f.y - drone.y;
      const d2 = dx * dx + dy * dy;
      if (d2 < minD2) { minD2 = d2; nearestF = f; }
    }

    const d = Math.sqrt(minD2);
    if (d < IDEAL_DIST - 30) {
      // too close — back away
      return {
        x: drone.x + (drone.x - nearestF.x) / d * 80,
        y: drone.y + (drone.y - nearestF.y) / d * 80,
      };
    }
    // comfortable range — hold position near objective direction
    const ox = this.objective.x - drone.x;
    const oy = this.objective.y - drone.y;
    const ol = Math.sqrt(ox * ox + oy * oy) || 1;
    return { x: drone.x + ox / ol * 40, y: drone.y + oy / ol * 40 };
  }

  _clampToBounds(drone) {
    const m = 10;
    const { width, height } = this.canvas;
    if (drone.x < -m) drone.x = -m;
    if (drone.x > width + m) drone.x = width + m;
    if (drone.y < -m) drone.y = -m;
    if (drone.y > height + m) drone.y = height + m;
  }

  draw(ctx) {
    for (const d of this.drones) {
      // Override color based on role before drawing
      if (d._roleColor) {
        d._savedFillStyle  = d._roleColor;
        d._savedShadowColor = d._roleShadow;
      }
      this._drawDrone(ctx, d);
      if (d.hp < d.maxHp) this._drawHPBar(ctx, d);
    }
  }

  _drawDrone(ctx, d) {
    const color = d._roleColor ?? '#ff3c3c';

    // trail
    if (d.trail.length > 1) {
      ctx.save();
      for (let i = 1; i < d.trail.length; i++) {
        const alpha = (i / d.trail.length) * 0.28;
        ctx.strokeStyle = color.replace('rgb', 'rgba').replace(')', `,${alpha})`);
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(d.trail[i - 1].x, d.trail[i - 1].y);
        ctx.lineTo(d.trail[i].x, d.trail[i].y);
        ctx.stroke();
      }
      ctx.restore();
    }

    ctx.save();
    ctx.translate(d.x, d.y);
    ctx.rotate(d.angle);
    ctx.fillStyle = color;
    ctx.shadowColor = color;
    ctx.shadowBlur = 8;

    // shape varies by role
    ctx.beginPath();
    if (d.role === 'sniper') {
      // elongated diamond
      ctx.moveTo(10, 0); ctx.lineTo(0, -3); ctx.lineTo(-8, 0);
      ctx.lineTo(0, 3);
    } else if (d.role === 'flanker') {
      // wider arrow
      ctx.moveTo(8, 0); ctx.lineTo(-6, -5); ctx.lineTo(-4, 0); ctx.lineTo(-6, 5);
    } else {
      // standard arrow
      ctx.moveTo(8, 0); ctx.lineTo(-5, -4); ctx.lineTo(-3, 0); ctx.lineTo(-5, 4);
    }
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }

  _drawHPBar(ctx, d) {
    const bw = 18, bh = 2;
    const bx = d.x - bw / 2, by = d.y - 12;
    const color = d._roleColor ?? '#ff3c3c';
    ctx.fillStyle = 'rgba(0,0,0,0.5)';
    ctx.fillRect(bx, by, bw, bh);
    ctx.fillStyle = color;
    ctx.fillRect(bx, by, bw * (d.hp / d.maxHp), bh);
  }

  serializeState() {
    return this.drones.map((d) => ({
      x:    +(d.x.toFixed(1)),
      y:    +(d.y.toFixed(1)),
      vx:   +(d.vx.toFixed(1)),
      vy:   +(d.vy.toFixed(1)),
      role: d.role ?? 'rusher',
      hp:   d.hp,
    }));
  }
}
