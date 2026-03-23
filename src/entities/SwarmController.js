import { Drone } from './Drone.js';
import { computeBoidForce } from '../ai/Boids.js';
import { FORMATIONS } from '../ai/Formations.js';
import { FRIENDLY_ROLES } from './FriendlyRoles.js';

export class SwarmController {
  constructor(count, canvas, type) {
    this.canvas = canvas;
    this.type = type;
    this.currentFormation = 'wedge';
    this.targetZone = null; // {x, y} — where the swarm should go
    this.formationTargets = []; // per-drone targets from formation calc

    this.drones = Array.from({ length: count }, () =>
      this._makeDrone('standard',
        canvas.width / 2 + (Math.random() - 0.5) * 150,
        canvas.height * 0.7 + (Math.random() - 0.5) * 100,
      )
    );
  }

  // ── Internal factory ──────────────────────────────────────────────────────

  _makeDrone(role, x, y) {
    const d = new Drone(x, y, this.type);
    this._applyRole(d, role);
    return d;
  }

  _applyRole(drone, role) {
    const cfg = FRIENDLY_ROLES[role] ?? FRIENDLY_ROLES.standard;
    drone.role      = role;
    drone.hp        = cfg.hp;
    drone.maxHp     = cfg.maxHp;
    drone.maxSpeed  = cfg.maxSpeed;
    drone.fireRange = cfg.fireRange;
    drone.fireDamage = cfg.fireDamage;
    drone.fireRate  = cfg.fireRate;
    drone._fireTimer = Math.random() * cfg.fireRate;
    drone._roleColor   = cfg.color;
    drone._roleShadow  = cfg.shadowColor;
  }

  // ── Public API ─────────────────────────────────────────────────────────────

  setFormation(name, cx, cy) {
    if (!FORMATIONS[name]) return;
    this.currentFormation = name;
    const tx = cx ?? (this.targetZone?.x ?? this.canvas.width / 2);
    const ty = cy ?? (this.targetZone?.y ?? this.canvas.height / 2);
    this._recalcFormation(name, tx, ty);
  }

  setTargetZone(x, y) {
    this.targetZone = { x, y };
    this._recalcFormation(this.currentFormation, x, y);
  }

  _recalcFormation(name, cx, cy) {
    const positions = FORMATIONS[name](this.drones.length, cx, cy);
    this.formationTargets = positions;
    this.drones.forEach((d, i) => {
      d.target = positions[i] ?? { x: cx, y: cy };
    });
  }

  /** Add n drones of the given role (default 'standard') */
  reinforce(n, role = 'standard') {
    for (let i = 0; i < n; i++) {
      const d = this._makeDrone(
        role,
        this.canvas.width / 2 + (Math.random() - 0.5) * 100,
        this.canvas.height - 80,
      );
      if (this.formationTargets.length > 0) {
        d.target = this.formationTargets[i % this.formationTargets.length];
      }
      this.drones.push(d);
    }
  }

  // ── Update ────────────────────────────────────────────────────────────────

  update(dt, enemies) {
    this.drones.forEach((drone) => {
      // Each drone uses its own role's boid config
      const boidCfg = (FRIENDLY_ROLES[drone.role ?? 'standard']).boids;

      const force = computeBoidForce(drone, this.drones, drone.target, boidCfg);

      // Avoid enemies slightly
      for (const e of enemies) {
        const dx = drone.x - e.x;
        const dy = drone.y - e.y;
        const dist = Math.sqrt(dx * dx + dy * dy) || 0.001;
        if (dist < 50) {
          force.fx += (dx / dist) * 0.3;
          force.fy += (dy / dist) * 0.3;
        }
      }

      drone.update(dt, force);
      this._clampToBounds(drone);
    });
  }

  _clampToBounds(drone) {
    const m = 30;
    const { width, height } = this.canvas;
    if (drone.x < m) drone.vx += 1;
    if (drone.x > width - m) drone.vx -= 1;
    if (drone.y < m) drone.vy += 1;
    if (drone.y > height - m) drone.vy -= 1;
  }

  // ── Draw ──────────────────────────────────────────────────────────────────

  draw(ctx) {
    // Formation target lines (subtle)
    if (this.targetZone && this.formationTargets.length > 0) {
      ctx.save();
      ctx.strokeStyle = 'rgba(0,212,255,0.08)';
      ctx.lineWidth = 1;
      this.drones.forEach((d, i) => {
        const t = this.formationTargets[i];
        if (!t) return;
        ctx.beginPath();
        ctx.moveTo(d.x, d.y);
        ctx.lineTo(t.x, t.y);
        ctx.stroke();
      });
      ctx.restore();
    }

    this.drones.forEach((d) => this._drawDrone(ctx, d));
  }

  _drawDrone(ctx, d) {
    const color  = d._roleColor  ?? '#00d4ff';
    const shadow = d._roleShadow ?? '#00d4ff';
    const role   = d.role ?? 'standard';

    // Trail
    if (d.trail.length > 1) {
      ctx.save();
      for (let i = 1; i < d.trail.length; i++) {
        const alpha = (i / d.trail.length) * 0.28;
        ctx.strokeStyle = `${color}${Math.round(alpha * 255).toString(16).padStart(2, '0')}`;
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
    ctx.shadowColor = shadow;
    ctx.shadowBlur = 9;

    ctx.beginPath();
    switch (role) {
      case 'interceptor':
        // Narrow, fast-looking needle
        ctx.moveTo(11, 0);
        ctx.lineTo(-4, -2.5);
        ctx.lineTo(-2, 0);
        ctx.lineTo(-4, 2.5);
        break;

      case 'gunship':
        // Wide diamond — heavier presence
        ctx.moveTo(9, 0);
        ctx.lineTo(0, -6);
        ctx.lineTo(-7, 0);
        ctx.lineTo(0, 6);
        break;

      case 'sentinel':
        // Flat hexagon — stationary guardian
        for (let k = 0; k < 6; k++) {
          const a = (k * Math.PI) / 3;
          k === 0
            ? ctx.moveTo(Math.cos(a) * 7, Math.sin(a) * 7)
            : ctx.lineTo(Math.cos(a) * 7, Math.sin(a) * 7);
        }
        break;

      default: // standard — original arrow
        ctx.moveTo(8, 0);
        ctx.lineTo(-5, -4);
        ctx.lineTo(-3, 0);
        ctx.lineTo(-5, 4);
    }
    ctx.closePath();
    ctx.fill();
    ctx.restore();

    // HP bar (when damaged)
    if (d.hp < d.maxHp) {
      const bw = 18, bh = 2;
      const bx = d.x - bw / 2, by = d.y - 12;
      ctx.fillStyle = 'rgba(0,0,0,0.5)';
      ctx.fillRect(bx, by, bw, bh);
      ctx.fillStyle = color;
      ctx.fillRect(bx, by, bw * (d.hp / d.maxHp), bh);
    }
  }

  // ── Serialize ─────────────────────────────────────────────────────────────

  serializeState() {
    return this.drones.map((d) => ({
      x:    +(d.x.toFixed(1)),
      y:    +(d.y.toFixed(1)),
      vx:   +(d.vx.toFixed(1)),
      vy:   +(d.vy.toFixed(1)),
      role: d.role ?? 'standard',
      hp:   d.hp,
    }));
  }
}
