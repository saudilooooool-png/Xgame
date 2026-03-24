import { Drone } from './Drone.js';
import { computeBoidForce } from '../ai/Boids.js';
import { ENEMY_ROLES, BOSS_ROLE, waveComposition, getScaledConfig } from './EnemyRoles.js';

// Unified boids config lookup — works for all roles
function _roleBoids(drone) {
  if (drone.role === 'boss') return BOSS_ROLE.boids;
  return (ENEMY_ROLES[drone.role ?? 'rusher']).boids;
}

export class EnemySwarm {
  constructor(count, canvas, objectives) {
    this.canvas = canvas;
    this.objectives = Array.isArray(objectives) ? objectives : [objectives];
    this.drones = [];
    this.spawning = false;
    this.defenseProfile = null;
    if (count > 0) this.spawnWave(1, count);
  }

  /** Pick which objective this drone should target */
  _pickObjectiveTarget(role, wave) {
    const alive = this.objectives.filter(o => o.health > 0);
    if (!alive.length) return this.objectives[0];

    if (role === 'boss' || role === 'commander') {
      return alive.reduce((min, o) =>
        o.health / o.maxHealth < min.health / min.maxHealth ? o : min, alive[0]);
    }

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

  get objective() { return this.objectives.find(o => o.health > 0) ?? this.objectives[0]; }

  spawnWave(wave, overrideCount) {
    this.spawning = true;
    const isBossWave = wave % 5 === 0;
    const profile    = this.defenseProfile;

    const baseCount  = Math.min(10 + wave * 3, 40);
    const scaledCount = profile
      ? Math.round(baseCount * profile.strategy.sizeMulti)
      : baseCount;
    const count = overrideCount ?? scaledCount;

    const { width, height } = this.canvas;
    const allEdges = ['top', 'left', 'right', 'bottom'];

    let edges = allEdges;
    if (profile?.strategy.edgeBias && profile.guessedApproach) {
      edges = [...allEdges, profile.guessedApproach, profile.guessedApproach];
    }

    const roleWeights = profile?.strategy.roleWeights ?? null;
    const roles = waveComposition(wave, count, roleWeights);

    for (let i = 0; i < count; i++) {
      const edge = edges[Math.floor(Math.random() * edges.length)];
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

      // Commander always accompanies the boss
      const cmd = new Drone(width / 2 + 40, -60, 'enemy');
      this._applyConfig(cmd, 'commander', getScaledConfig('commander', wave));
      cmd._assignedObjective = this._pickObjectiveTarget('commander', wave);
    } else if (wave >= 6 && Math.random() < 0.30) {
      // 30% chance of a lone commander from wave 6+
      const x = Math.random() * width, y = -30;
      const cmd = new Drone(x, y, 'enemy');
      this._applyConfig(cmd, 'commander', getScaledConfig('commander', wave));
      cmd._assignedObjective = this._pickObjectiveTarget('commander', wave);
    }

    this.spawning = false;
  }

  _applyConfig(drone, role, cfg) {
    drone.role            = role;
    drone.hp              = cfg.hp;
    drone.maxHp           = cfg.maxHp;
    drone.maxSpeed        = cfg.maxSpeed;
    drone.fireRange       = cfg.fireRange;
    drone.fireDamage      = cfg.fireDamage;
    drone._baseFireDamage = cfg.fireDamage; // for commander buff reset
    drone.fireRate        = cfg.fireRate;
    drone._fireTimer      = Math.random() * cfg.fireRate;
    drone._roleColor      = cfg.color;
    drone._roleShadow     = cfg.shadowColor;
    this.drones.push(drone);
    return drone;
  }

  update(dt, friendlyDrones) {
    // ── Reset per-frame commander buffs ───────────────────────────────────────
    for (const d of this.drones) {
      d._commanderBuffed = false;
      d.fireDamage       = d._baseFireDamage ?? d.fireDamage;
    }

    // ── Apply commander aura FIRST so buffs are active during combat ──────────
    for (const commander of this.drones) {
      if (commander.role !== 'commander') continue;
      const auraR2 = 150 * 150;
      for (const other of this.drones) {
        if (other === commander || other.role === 'commander') continue;
        const dx = other.x - commander.x, dy = other.y - commander.y;
        if (dx * dx + dy * dy < auraR2) {
          other._commanderBuffed = true;
          other.fireDamage = Math.round((other._baseFireDamage ?? other.fireDamage) * 1.20);
        }
      }
      // Rotate commander visual ring
      commander._rotAngle = ((commander._rotAngle ?? 0) + dt * 1.8) % (Math.PI * 2);
    }

    // ── Main update loop ──────────────────────────────────────────────────────
    for (const drone of this.drones) {
      // Redirect if assigned objective was destroyed
      if (drone._assignedObjective && drone._assignedObjective.health <= 0) {
        const alive = this.objectives.filter(o => o.health > 0);
        drone._assignedObjective = alive.length ? alive[0] : this.objectives[0];
      }
      const myObjective = drone._assignedObjective ?? this.objective;

      // ── Stealth: compute reveal state ──────────────────────────────────────
      if (drone.role === 'stealth') {
        drone._revealed = friendlyDrones.some(f => {
          const dx = f.x - drone.x, dy = f.y - drone.y;
          return dx * dx + dy * dy < 60 * 60;
        });
      }

      // ── Kamikaze: direct charge, no boids, accelerates near objective ──────
      if (drone.role === 'kamikaze') {
        const dx = myObjective.x - drone.x;
        const dy = myObjective.y - drone.y;
        const dist = Math.sqrt(dx * dx + dy * dy) || 1;
        drone._distToObj = dist;
        const proximity = Math.max(0, 1 - dist / 400);
        drone.maxSpeed   = Math.round(65 + proximity * 140);
        const intensity  = 1.5 + proximity * 2.5;
        drone.update(dt, { fx: (dx / dist) * intensity, fy: (dy / dist) * intensity });
        this._clampToBounds(drone);
        continue; // skip normal boid calculation
      }

      // ── Normal roles: determine seek target ───────────────────────────────
      let seekTarget;
      switch (drone.role) {
        case 'flanker':
          seekTarget = this._flankerTarget(drone, friendlyDrones, myObjective);
          break;
        case 'sniper':
          seekTarget = this._sniperTarget(drone, friendlyDrones, myObjective);
          break;
        case 'commander':
          seekTarget = this._commanderTarget(drone, myObjective);
          break;
        case 'boss':
          seekTarget = Math.random() < 0.02
            ? this._nearestFriendly(drone, friendlyDrones) ?? myObjective
            : myObjective;
          break;
        default: // rusher, stealth
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

  /** Flanker: seeks a point 90° around the friendly centroid relative to its objective */
  _flankerTarget(drone, friendly, objective) {
    if (!friendly.length) return objective;
    const fcx = friendly.reduce((s, d) => s + d.x, 0) / friendly.length;
    const fcy = friendly.reduce((s, d) => s + d.y, 0) / friendly.length;
    const toObjX = objective.x - fcx;
    const toObjY = objective.y - fcy;
    const len = Math.sqrt(toObjX * toObjX + toObjY * toObjY) || 1;
    const perp = drone._flankSign ?? (drone._flankSign = Math.random() < 0.5 ? 1 : -1);
    return {
      x: objective.x + (-toObjY / len) * 120 * perp,
      y: objective.y + ( toObjX / len) * 120 * perp,
    };
  }

  /** Sniper: stays 160-220px away from nearest friendly */
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
      return {
        x: drone.x + (drone.x - nearestF.x) / d * 80,
        y: drone.y + (drone.y - nearestF.y) / d * 80,
      };
    }
    const ox = objective.x - drone.x;
    const oy = objective.y - drone.y;
    const ol = Math.sqrt(ox * ox + oy * oy) || 1;
    return { x: drone.x + ox / ol * 40, y: drone.y + oy / ol * 40 };
  }

  /**
   * Commander: positions itself 180px behind the swarm centroid (relative to objective).
   * Fires at range and keeps the formation buffed.
   */
  _commanderTarget(drone, objective) {
    const allies = this.drones.filter(d => d !== drone && d.role !== 'commander');
    if (!allies.length) return objective;

    const cx = allies.reduce((s, d) => s + d.x, 0) / allies.length;
    const cy = allies.reduce((s, d) => s + d.y, 0) / allies.length;

    // Vector from centroid toward objective
    const toObjX = objective.x - cx;
    const toObjY = objective.y - cy;
    const len = Math.sqrt(toObjX * toObjX + toObjY * toObjY) || 1;

    // Stay 180px BEHIND centroid (away from objective)
    return {
      x: cx - (toObjX / len) * 180,
      y: cy - (toObjY / len) * 180,
    };
  }

  _clampToBounds(drone) {
    const m = 10;
    const { width, height } = this.canvas;
    if (drone.x < -m)       drone.x = -m;
    if (drone.x > width + m) drone.x = width + m;
    if (drone.y < -m)       drone.y = -m;
    if (drone.y > height + m) drone.y = height + m;
  }

  // ── Rendering ──────────────────────────────────────────────────────────────

  draw(ctx) {
    for (const d of this.drones) {
      // Commander-buffed drones get a faint gold halo
      if (d._commanderBuffed && d.role !== 'commander') {
        ctx.save();
        ctx.strokeStyle = 'rgba(255,170,0,0.30)';
        ctx.lineWidth   = 1.2;
        ctx.shadowColor = '#ffaa00';
        ctx.shadowBlur  = 6;
        ctx.beginPath();
        ctx.arc(d.x, d.y, 10, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();
      }

      this._drawDrone(ctx, d);
      if (d.hp < d.maxHp) this._drawHPBar(ctx, d);
    }
  }

  _drawDrone(ctx, d) {
    const role   = d.role ?? 'rusher';
    const color  = d._roleColor ?? '#ff3c3c';
    const isBoss = role === 'boss';
    const sc     = d._scale ?? 1;

    // ── Stealth: mostly invisible unless revealed ──────────────────────────
    if (role === 'stealth' && !d._revealed) {
      // Ghost shimmer — barely perceptible flicker
      const flicker = 0.08 + Math.sin(Date.now() / 400 + d.x) * 0.04;
      ctx.save();
      ctx.globalAlpha = Math.max(0.04, flicker);
      this._drawShape(ctx, d, color, sc);
      ctx.globalAlpha = 1;
      ctx.restore();
      return; // skip HP bar, skip commander ring
    }

    // ── Kamikaze: pulsing danger ring ─────────────────────────────────────
    if (role === 'kamikaze') {
      const proximity = Math.max(0, 1 - (d._distToObj ?? 400) / 400);
      const pulse     = (Math.sin(Date.now() / (200 - proximity * 150)) + 1) / 2;
      const ringR     = 11 + proximity * 9;
      ctx.save();
      ctx.strokeStyle = `rgba(255,${Math.round(80 * (1 - proximity))},0,${0.45 + pulse * 0.45})`;
      ctx.lineWidth   = 1.5 + proximity * 1.5;
      ctx.shadowColor = '#ff4400';
      ctx.shadowBlur  = 8 + proximity * 18;
      ctx.beginPath();
      ctx.arc(d.x, d.y, ringR * (0.85 + pulse * 0.2), 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }

    // ── Commander: rotating dashed ring + aura pulse ───────────────────────
    if (role === 'commander') {
      ctx.save();
      ctx.translate(d.x, d.y);
      ctx.strokeStyle = 'rgba(255,170,0,0.45)';
      ctx.lineWidth   = 1.5;
      ctx.shadowColor = '#ffaa00';
      ctx.shadowBlur  = 8;
      ctx.setLineDash([8, 6]);
      ctx.lineDashOffset = -((d._rotAngle ?? 0) * 25);
      ctx.beginPath();
      ctx.arc(0, 0, 24, 0, Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.restore();
    }

    // ── Main shape ─────────────────────────────────────────────────────────
    this._drawShape(ctx, d, color, sc);
  }

  /** Draw the actual drone body shape */
  _drawShape(ctx, d, color, sc) {
    const role   = d.role ?? 'rusher';
    const isBoss = role === 'boss';

    // Trail
    if (d.trail.length > 1) {
      ctx.save();
      for (let i = 1; i < d.trail.length; i++) {
        const alpha = (i / d.trail.length) * (isBoss ? 0.45 : 0.28);
        ctx.strokeStyle = `${color}${Math.round(alpha * 255).toString(16).padStart(2, '0')}`;
        ctx.lineWidth = isBoss ? 2.5 : 1;
        ctx.beginPath();
        ctx.moveTo(d.trail[i - 1].x, d.trail[i - 1].y);
        ctx.lineTo(d.trail[i].x,     d.trail[i].y);
        ctx.stroke();
      }
      ctx.restore();
    }

    ctx.save();
    ctx.translate(d.x, d.y);
    ctx.rotate(d.angle);
    if (sc !== 1) ctx.scale(sc, sc);

    ctx.fillStyle   = color;
    ctx.shadowColor = color;
    ctx.shadowBlur  = isBoss ? 22 : (role === 'commander' ? 14 : 8);

    ctx.beginPath();

    if (isBoss) {
      // Hexagonal boss
      const R = 12;
      for (let i = 0; i < 6; i++) {
        const a = (i * Math.PI) / 3 - Math.PI / 6;
        i === 0
          ? ctx.moveTo(Math.cos(a) * R, Math.sin(a) * R)
          : ctx.lineTo(Math.cos(a) * R, Math.sin(a) * R);
      }
      ctx.closePath();
      ctx.fill();
      ctx.shadowBlur = 0;
      ctx.fillStyle  = '#fff8aa';
      ctx.beginPath();
      ctx.arc(0, 0, 4, 0, Math.PI * 2);
      ctx.fill();

    } else if (role === 'commander') {
      // Octagon with inner star — clearly a command unit
      for (let i = 0; i < 8; i++) {
        const a = (i * Math.PI) / 4;
        i === 0
          ? ctx.moveTo(Math.cos(a) * 10, Math.sin(a) * 10)
          : ctx.lineTo(Math.cos(a) * 10, Math.sin(a) * 10);
      }
      ctx.closePath();
      ctx.fill();
      // Inner bright core
      ctx.shadowBlur = 0;
      ctx.fillStyle  = '#ffe066';
      ctx.beginPath();
      ctx.arc(0, 0, 3.5, 0, Math.PI * 2);
      ctx.fill();

    } else if (role === 'kamikaze') {
      // Bold triangle — dart pointing forward
      ctx.moveTo(11, 0);
      ctx.lineTo(-6, -6);
      ctx.lineTo(-3, 0);
      ctx.lineTo(-6,  6);
      ctx.closePath();
      ctx.fill();

    } else if (role === 'stealth') {
      // Slim needle — minimal profile
      ctx.moveTo(10, 0);
      ctx.lineTo(-4, -2.5);
      ctx.lineTo(-2, 0);
      ctx.lineTo(-4,  2.5);
      ctx.closePath();
      ctx.fill();

    } else if (role === 'sniper') {
      ctx.moveTo(10, 0); ctx.lineTo(0, -3); ctx.lineTo(-8, 0); ctx.lineTo(0, 3);
      ctx.closePath();
      ctx.fill();

    } else if (role === 'flanker') {
      ctx.moveTo(8, 0); ctx.lineTo(-6, -5); ctx.lineTo(-4, 0); ctx.lineTo(-6, 5);
      ctx.closePath();
      ctx.fill();

    } else {
      // Rusher (default)
      ctx.moveTo(8, 0); ctx.lineTo(-5, -4); ctx.lineTo(-3, 0); ctx.lineTo(-5, 4);
      ctx.closePath();
      ctx.fill();
    }

    ctx.restore();
  }

  _drawHPBar(ctx, d) {
    const isBoss = d.role === 'boss';
    const isCmd  = d.role === 'commander';
    const bw = isBoss ? 50 : isCmd ? 28 : 18;
    const bh = isBoss ? 4  : 2;
    const bx = d.x - bw / 2;
    const by = d.y - (isBoss ? 22 : isCmd ? 16 : 12);
    const color = d._roleColor ?? '#ff3c3c';
    ctx.fillStyle = 'rgba(0,0,0,0.5)';
    ctx.fillRect(bx, by, bw, bh);
    ctx.fillStyle = color;
    ctx.fillRect(bx, by, bw * (d.hp / d.maxHp), bh);
    if (isBoss || isCmd) {
      ctx.strokeStyle = color;
      ctx.lineWidth   = 0.5;
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
