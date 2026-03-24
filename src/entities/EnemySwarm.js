import { Drone } from './Drone.js';
import { computeBoidForce } from '../ai/Boids.js';
import { ENEMY_ROLES, BOSS_ROLE, waveComposition, getScaledConfig } from './EnemyRoles.js';

// Unified boids config lookup — works for normal roles AND boss
function _roleBoids(drone) {
  if (drone.role === 'boss') return BOSS_ROLE.boids;
  return (ENEMY_ROLES[drone.role ?? 'rusher']).boids;
}

export class EnemySwarm {
  constructor(count, canvas, objectives) {
    this.canvas = canvas;
    // Support both single objective (legacy) and array of objectives
    this.objectives = Array.isArray(objectives) ? objectives : [objectives];
    this.drones = [];
    this.spawning = false;
    this.defenseProfile = null;  // set by Game after mission setup
    if (count > 0) this.spawnWave(1, count);
  }

  /** Pick which objective this drone should target based on wave & role */
  _pickObjectiveTarget(role, wave) {
    const alive = this.objectives.filter(o => o.health > 0);
    if (!alive.length) return this.objectives[0];

    // Boss always targets the weakest alive objective
    if (role === 'boss') {
      return alive.reduce((min, o) =>
        o.health / o.maxHealth < min.health / min.maxHealth ? o : min, alive[0]);
    }

    // Wave-based distribution: enemies focus different resources over time
    // Wave 1-3: all target power | Wave 4-6: power + water | Wave 7+: all 3
    const rand = Math.random();
    if (wave <= 3) {
      return alive.find(o => o.resourceType === 'power') ?? alive[0];
    } else if (wave <= 6) {
      const obj = rand < 0.6
        ? alive.find(o => o.resourceType === 'power')
        : alive.find(o => o.resourceType === 'water');
      return obj ?? alive[0];
    } else {
      if (rand < 0.40) return alive.find(o => o.resourceType === 'power')  ?? alive[0];
      if (rand < 0.70) return alive.find(o => o.resourceType === 'water')  ?? alive[0];
      return                   alive.find(o => o.resourceType === 'food')   ?? alive[0];
    }
  }

  /** Convenience: primary objective (first alive) */
  get objective() { return this.objectives.find(o => o.health > 0) ?? this.objectives[0]; }

  spawnWave(wave, overrideCount) {
    this.spawning = true;
    const isBossWave = wave % 5 === 0;
    const profile = this.defenseProfile;

    // Base count, scaled by defender strategy if available
    const baseCount = Math.min(10 + wave * 3, 40);
    const scaledCount = profile
      ? Math.round(baseCount * profile.strategy.sizeMulti)
      : baseCount;
    const count = overrideCount ?? scaledCount;

    const { width, height } = this.canvas;
    const allEdges = ['top', 'left', 'right', 'bottom'];

    // Defender biases spawn edge toward guessed approach if correct
    let edges = allEdges;
    if (profile?.strategy.edgeBias && profile.guessedApproach) {
      // Weight guessed approach edge more heavily (appears 3× in pool)
      edges = [...allEdges, profile.guessedApproach, profile.guessedApproach];
    }

    // Role weights from strategy
    const roleWeights = profile?.strategy.roleWeights ?? { rusher: 2, flanker: 1, sniper: 1 };
    const roles = waveComposition(wave, count, roleWeights);

    for (let i = 0; i < count; i++) {
      const edge = edges[Math.floor(Math.random() * edges.length)];  // uses biased edges pool
      let x, y;
      if (edge === 'top')         { x = Math.random() * width;  y = -20; }
      else if (edge === 'bottom') { x = Math.random() * width;  y = height + 20; }
      else if (edge === 'left')   { x = -20;                    y = Math.random() * height; }
      else                        { x = width + 20;             y = Math.random() * height; }

      const role = roles[i];
      const cfg  = getScaledConfig(role, wave);
      const drone = this._applyConfig(new Drone(x, y, 'enemy'), role, cfg);
      drone._assignedObjective = this._pickObjectiveTarget(role, wave);
    }

    // Boss spawns from the top center on boss waves
    if (isBossWave) {
      const boss = new Drone(width / 2, -30, 'enemy');
      this._applyConfig(boss, 'boss', BOSS_ROLE);
      boss._scale = BOSS_ROLE.scale;
      boss._assignedObjective = this._pickObjectiveTarget('boss', wave);
    }

    this.spawning = false;
  }

  _applyConfig(drone, role, cfg) {
    drone.role       = role;
    drone.hp         = cfg.hp;
    drone.maxHp      = cfg.maxHp;
    drone.maxSpeed   = cfg.maxSpeed;
    drone.fireRange  = cfg.fireRange;
    drone.fireDamage = cfg.fireDamage;
    drone.fireRate   = cfg.fireRate;
    drone._fireTimer = Math.random() * cfg.fireRate;
    drone._roleColor  = cfg.color;
    drone._roleShadow = cfg.shadowColor;
    this.drones.push(drone);
    return drone;
  }

  update(dt, friendlyDrones) {
    const friendly = friendlyDrones;

    for (const drone of this.drones) {
      // If assigned objective was destroyed, redirect to next alive one
      if (drone._assignedObjective && drone._assignedObjective.health <= 0) {
        const alive = this.objectives.filter(o => o.health > 0);
        drone._assignedObjective = alive.length ? alive[0] : this.objectives[0];
      }
      const myObjective = drone._assignedObjective ?? this.objective;

      let seekTarget;

      switch (drone.role) {
        case 'flanker':
          seekTarget = this._flankerTarget(drone, friendly, myObjective);
          break;
        case 'sniper':
          seekTarget = this._sniperTarget(drone, friendly, myObjective);
          break;
        case 'boss':
          // Boss charges its objective; occasionally switches to nearest friendly
          seekTarget = Math.random() < 0.02
            ? this._nearestFriendly(drone, friendly) ?? myObjective
            : myObjective;
          break;
        default: // rusher
          seekTarget = myObjective;
          break;
      }

      // Occasionally retarget
      if (Math.random() < 0.003) drone.target = seekTarget;
      else if (!drone.target)    drone.target = seekTarget;

      const force = computeBoidForce(drone, this.drones, drone.target, _roleBoids(drone));
      drone.update(dt, force);
      this._clampToBounds(drone);
    }
  }

  /** Returns the closest friendly drone, or null */
  _nearestFriendly(drone, friendly) {
    let best = null, bestD2 = Infinity;
    for (const f of friendly) {
      const dx = f.x - drone.x, dy = f.y - drone.y;
      const d2 = dx * dx + dy * dy;
      if (d2 < bestD2) { bestD2 = d2; best = f; }
    }
    return best;
  }

  // ── Role-specific target calculations ─────────────────────────────────────

  /** Flanker: seeks a point 90° around the friendly centroid relative to its objective */
  _flankerTarget(drone, friendly, objective) {
    if (!friendly.length) return objective;

    // friendly centroid
    const fcx = friendly.reduce((s, d) => s + d.x, 0) / friendly.length;
    const fcy = friendly.reduce((s, d) => s + d.y, 0) / friendly.length;

    // vector from friendly centroid → objective
    const toObjX = objective.x - fcx;
    const toObjY = objective.y - fcy;
    const len = Math.sqrt(toObjX * toObjX + toObjY * toObjY) || 1;

    // go 90° offset to approach from the flank
    const perp = drone._flankSign ?? (drone._flankSign = Math.random() < 0.5 ? 1 : -1);
    return {
      x: objective.x + (-toObjY / len) * 120 * perp,
      y: objective.y + ( toObjX / len) * 120 * perp,
    };
  }

  /** Sniper: stays 160-220px away from nearest friendly, retreats if too close */
  _sniperTarget(drone, friendly, objective) {
    if (!friendly.length) return objective;

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
    const ox = objective.x - drone.x;
    const oy = objective.y - drone.y;
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
    const isBoss = d.role === 'boss';
    const sc = d._scale ?? 1;

    // trail
    if (d.trail.length > 1) {
      ctx.save();
      for (let i = 1; i < d.trail.length; i++) {
        const alpha = (i / d.trail.length) * (isBoss ? 0.45 : 0.28);
        ctx.strokeStyle = color.replace('rgb', 'rgba').replace(')', `,${alpha})`);
        ctx.lineWidth = isBoss ? 2.5 : 1;
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
    if (sc !== 1) ctx.scale(sc, sc);

    ctx.fillStyle = color;
    ctx.shadowColor = color;
    ctx.shadowBlur = isBoss ? 22 : 8;

    // shape varies by role
    ctx.beginPath();
    if (isBoss) {
      // hexagonal boss shape
      const R = 12;
      for (let i = 0; i < 6; i++) {
        const a = (i * Math.PI) / 3 - Math.PI / 6;
        i === 0 ? ctx.moveTo(Math.cos(a) * R, Math.sin(a) * R)
                : ctx.lineTo(Math.cos(a) * R, Math.sin(a) * R);
      }
      ctx.closePath();
      ctx.fill();
      // inner core
      ctx.shadowBlur = 0;
      ctx.fillStyle = '#fff8aa';
      ctx.beginPath();
      ctx.arc(0, 0, 4, 0, Math.PI * 2);
      ctx.fill();
    } else if (d.role === 'sniper') {
      // elongated diamond
      ctx.moveTo(10, 0); ctx.lineTo(0, -3); ctx.lineTo(-8, 0);
      ctx.lineTo(0, 3);
      ctx.closePath();
      ctx.fill();
    } else if (d.role === 'flanker') {
      // wider arrow
      ctx.moveTo(8, 0); ctx.lineTo(-6, -5); ctx.lineTo(-4, 0); ctx.lineTo(-6, 5);
      ctx.closePath();
      ctx.fill();
    } else {
      // standard arrow (rusher)
      ctx.moveTo(8, 0); ctx.lineTo(-5, -4); ctx.lineTo(-3, 0); ctx.lineTo(-5, 4);
      ctx.closePath();
      ctx.fill();
    }
    ctx.restore();
  }

  _drawHPBar(ctx, d) {
    const isBoss = d.role === 'boss';
    const bw = isBoss ? 50 : 18, bh = isBoss ? 4 : 2;
    const bx = d.x - bw / 2, by = d.y - (isBoss ? 22 : 12);
    const color = d._roleColor ?? '#ff3c3c';
    ctx.fillStyle = 'rgba(0,0,0,0.5)';
    ctx.fillRect(bx, by, bw, bh);
    ctx.fillStyle = color;
    ctx.fillRect(bx, by, bw * (d.hp / d.maxHp), bh);
    if (isBoss) {
      ctx.strokeStyle = color;
      ctx.lineWidth = 0.5;
      ctx.strokeRect(bx, by, bw, bh);
    }
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
