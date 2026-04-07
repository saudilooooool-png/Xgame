import { Drone } from './Drone.js';
import { computeBoidForce } from '../ai/Boids.js';
import { FORMATIONS, FORMATION_BOIDS } from '../ai/Formations.js';
import { FRIENDLY_ROLES } from './FriendlyRoles.js';
import { blueprintMultipliers } from '../data/PlayerIdentity.js';

export class SwarmController {
  constructor(count, canvas, type) {
    this.canvas = canvas;
    this.type   = type;
    this.currentFormation = 'wedge';
    this.targetZone       = null;
    this.formationTargets = [];

    // A/B group system
    this.activeGroup = 'A';        // which group the player controls
    this._targetA    = null;       // target zone for group A
    this._targetB    = null;       // target zone for group B

    // Player identity (set via setIdentity before spawning drones)
    this._identity = null;

    this.drones = Array.from({ length: count }, () =>
      this._makeDrone('standard',
        canvas.width / 2 + (Math.random() - 0.5) * 150,
        canvas.height * 0.7 + (Math.random() - 0.5) * 100,
      )
    );
  }

  // ── Identity ───────────────────────────────────────────────────────────────

  /** Call this BEFORE reinforce() so new drones receive the identity. */
  setIdentity(identity) {
    this._identity = identity;
    // Apply to existing drones too (e.g. after restart)
    for (const d of this.drones) this._applyIdentity(d, identity);
  }

  _applyIdentity(drone, identity) {
    if (!identity) return;
    drone._teamColor  = identity.teamColor;
    drone._teamShadow = identity.teamShadow;
    drone._radarShape = identity.radarShape;
  }

  // ── Internal factory ──────────────────────────────────────────────────────

  _makeDrone(role, x, y) {
    const d = new Drone(x, y, this.type);
    this._applyRole(d, role);
    if (this._identity) {
      this._applyIdentity(d, this._identity);
      this._applyBlueprint(d, this._identity.blueprint);
    }
    return d;
  }

  _applyRole(drone, role) {
    const cfg = FRIENDLY_ROLES[role] ?? FRIENDLY_ROLES.standard;
    drone.role       = role;
    drone.hp         = cfg.hp;
    drone.maxHp      = cfg.maxHp;
    drone.maxSpeed   = cfg.maxSpeed;
    drone.fireRange  = cfg.fireRange;
    drone.fireDamage = cfg.fireDamage;
    drone.fireRate   = cfg.fireRate;
    drone._fireTimer   = Math.random() * cfg.fireRate;
    drone._roleColor   = cfg.color;
    drone._roleShadow  = cfg.shadowColor;
  }

  /** Apply blueprint multipliers on top of role stats. */
  _applyBlueprint(drone, bp) {
    if (!bp) return;
    const m = blueprintMultipliers(bp);
    drone.maxSpeed   = Math.round(drone.maxSpeed   * m.speed);
    drone.maxHp      = Math.round(drone.maxHp      * m.armor);
    drone.hp         = drone.maxHp;
    drone.fireDamage = Math.round(drone.fireDamage * m.damage);
    drone.fireRate   = +(drone.fireRate * m.fireRate).toFixed(3);
    drone.fireRange  = Math.round(drone.fireRange  * m.range);
    if (m.aggrSpeed > 1) drone.maxSpeed = Math.round(drone.maxSpeed * m.aggrSpeed);
  }

  // ── Public API ─────────────────────────────────────────────────────────────

  setFormation(name, cx, cy) {
    if (!FORMATIONS[name]) return;
    this.currentFormation = name;
    const tx = cx ?? (this.targetZone?.x ?? this.canvas.width / 2);
    const ty = cy ?? (this.targetZone?.y ?? this.canvas.height / 2);
    this._recalcFormationForGroup('A', tx, ty);
    if (this._targetB) this._recalcFormationForGroup('B', this._targetB.x, this._targetB.y);
  }

  setTargetZone(x, y) {
    this.targetZone = { x, y };
    if (this.activeGroup === 'A') {
      this._targetA = { x, y };
      this._recalcFormationForGroup('A', x, y);
    } else {
      this._targetB = { x, y };
      this._recalcFormationForGroup('B', x, y);
    }
  }

  /** Recalculate formation targets for one group only. */
  _recalcFormationForGroup(group, cx, cy) {
    const groupDrones = this.drones.filter(d => !d.dead && d._group === group);
    if (!groupDrones.length) return;
    const positions = FORMATIONS[this.currentFormation](groupDrones.length, cx, cy);
    groupDrones.forEach((d, i) => {
      d.target = positions[i] ?? { x: cx, y: cy };
    });
    // Keep formationTargets compatible with old API (Group A only)
    if (group === 'A') this.formationTargets = positions;
  }

  // Kept for backward compatibility (used in draw)
  _recalcFormation(name, cx, cy) {
    this._recalcFormationForGroup('A', cx, cy);
  }

  /** Split drones evenly between group A and B (alternating). */
  splitGroups() {
    const alive = this.drones.filter(d => !d.dead);
    alive.forEach((d, i) => { d._group = i % 2 === 0 ? 'A' : 'B'; });
    if (this._targetA) this._recalcFormationForGroup('A', this._targetA.x, this._targetA.y);
    if (this._targetB) this._recalcFormationForGroup('B', this._targetB.x, this._targetB.y);
    else {
      // Default group B target: same as group A but shifted
      const tA = this._targetA ?? { x: this.canvas.width / 2, y: this.canvas.height / 2 };
      this._targetB = { x: tA.x + 60, y: tA.y + 60 };
      this._recalcFormationForGroup('B', this._targetB.x, this._targetB.y);
    }
  }

  /** Merge both groups back into A. */
  mergeGroups() {
    this.drones.forEach(d => { d._group = 'A'; });
    this.activeGroup = 'A';
    if (this._targetA) this._recalcFormationForGroup('A', this._targetA.x, this._targetA.y);
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
      // Each drone uses its own role's boid config, modified by current formation
      const baseBoidsConfig = (FRIENDLY_ROLES[drone.role ?? 'standard']).boids;
      const fMul = FORMATION_BOIDS[this.currentFormation] ?? FORMATION_BOIDS.watch;
      const boidCfg = {
        ...baseBoidsConfig,
        separationWeight: baseBoidsConfig.separationWeight * fMul.sep,
        alignmentWeight:  baseBoidsConfig.alignmentWeight  * fMul.ali,
        cohesionWeight:   baseBoidsConfig.cohesionWeight   * fMul.coh,
        seekWeight:       baseBoidsConfig.seekWeight       * fMul.seek,
      };

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

      // ── HUD exclusion zones (soft repulsion) ──────────────────────────
      // Top-left panel: roughly 220×320px
      const HX = 220, HY = 320;
      if (drone.x < HX && drone.y < HY) {
        force.fx += ((HX - drone.x) / HX) * 0.6;
        force.fy += ((HY - drone.y) / HY) * 0.6;
      }
      // Top-right panel: roughly 200px wide × 60px tall
      if (drone.x > this.canvas.width - 200 && drone.y < 60) {
        force.fx -= ((drone.x - (this.canvas.width - 200)) / 200) * 0.4;
        force.fy += 0.2;
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
    // Team color takes priority over role color for friendly drones
    const color  = d._teamColor  ?? d._roleColor  ?? '#00d4ff';
    const shadow = d._teamShadow ?? d._roleShadow ?? '#00d4ff';
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

    // ── Group B indicator (dashed ring) ──────────────────────────────
    if (d._group === 'B') {
      ctx.save();
      ctx.strokeStyle = color;
      ctx.lineWidth   = 1;
      ctx.globalAlpha = 0.45;
      ctx.setLineDash([3, 4]);
      ctx.shadowBlur  = 0;
      ctx.beginPath();
      ctx.arc(d.x, d.y, 12, 0, Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.restore();
    }

    // ── Veteran ring ─────────────────────────────────────────────────
    if (d._vet === 1) {
      ctx.save();
      ctx.strokeStyle = '#ffcc00';
      ctx.lineWidth   = 1.2;
      ctx.shadowColor = '#ffcc00';
      ctx.shadowBlur  = 7;
      ctx.beginPath();
      ctx.arc(d.x, d.y, 14, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    } else if (d._vet >= 2) {
      ctx.save();
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth   = 1.5;
      ctx.shadowColor = '#ffffff';
      ctx.shadowBlur  = 10;
      ctx.beginPath();
      ctx.arc(d.x, d.y, 15, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }

    // HP bar (when damaged)
    if (d.hp < d.maxHp) {
      const bw = 18, bh = 2;
      const bx = d.x - bw / 2, by = d.y - 14;
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
