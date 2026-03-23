import { Drone } from './Drone.js';
import { computeBoidForce } from '../ai/Boids.js';
import { FORMATIONS } from '../ai/Formations.js';

export class SwarmController {
  constructor(count, canvas, type) {
    this.canvas = canvas;
    this.type = type;
    this.currentFormation = 'wedge';
    this.targetZone = null; // {x, y} — where the swarm should go
    this.formationTargets = []; // per-drone targets from formation calc

    this.drones = Array.from({ length: count }, () =>
      new Drone(
        canvas.width / 2 + (Math.random() - 0.5) * 150,
        canvas.height * 0.7 + (Math.random() - 0.5) * 100,
        type
      )
    );
  }

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

  reinforce(n) {
    for (let i = 0; i < n; i++) {
      const d = new Drone(
        this.canvas.width / 2 + (Math.random() - 0.5) * 100,
        this.canvas.height - 80,
        this.type
      );
      if (this.formationTargets.length > 0) {
        d.target = this.formationTargets[i % this.formationTargets.length];
      }
      this.drones.push(d);
    }
  }

  update(dt, enemies) {
    const BOID_CONFIG = {
      separationRadius: 28,
      separationWeight: 2.0,
      alignmentRadius: 70,
      alignmentWeight: 0.8,
      cohesionRadius: 70,
      cohesionWeight: 0.6,
      seekWeight: 2.0,
      maxForce: 0.5,
      maxSpeed: 130,
    };

    this.drones.forEach((drone) => {
      const force = computeBoidForce(drone, this.drones, drone.target, BOID_CONFIG);

      // avoid enemies slightly
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

  draw(ctx) {
    // draw formation target lines (subtle)
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

    this.drones.forEach((d) => d.draw(ctx));
  }

  serializeState() {
    return this.drones.map((d) => ({
      x: +(d.x.toFixed(1)),
      y: +(d.y.toFixed(1)),
      vx: +(d.vx.toFixed(1)),
      vy: +(d.vy.toFixed(1)),
    }));
  }
}
