import { Drone } from './Drone.js';
import { computeBoidForce } from '../ai/Boids.js';

const ENEMY_CONFIG = {
  separationRadius: 24,
  separationWeight: 1.5,
  alignmentRadius: 60,
  alignmentWeight: 0.6,
  cohesionRadius: 60,
  cohesionWeight: 0.5,
  seekWeight: 2.5,
  maxForce: 0.35,
  maxSpeed: 90,
};

export class EnemySwarm {
  constructor(count, canvas, objective) {
    this.canvas = canvas;
    this.objective = objective;
    this.drones = [];
    this.spawning = false;
    this.spawnWave(1, count);
  }

  spawnWave(wave, overrideCount) {
    this.spawning = true;
    const count = overrideCount ?? Math.min(10 + wave * 3, 40);
    const { width, height } = this.canvas;
    const edges = ['top', 'left', 'right', 'bottom'];

    for (let i = 0; i < count; i++) {
      const edge = edges[Math.floor(Math.random() * edges.length)];
      let x, y;
      if (edge === 'top')    { x = Math.random() * width; y = -20; }
      else if (edge === 'bottom') { x = Math.random() * width; y = height + 20; }
      else if (edge === 'left')   { x = -20; y = Math.random() * height; }
      else                        { x = width + 20; y = Math.random() * height; }
      this.drones.push(new Drone(x, y, 'enemy'));
    }
    this.spawning = false;
  }

  update(dt, friendlyDrones) {
    this.drones.forEach((drone) => {
      // each enemy seeks the objective with slight boid behaviour
      const force = computeBoidForce(drone, this.drones, this.objective, ENEMY_CONFIG);

      // chase closest friendly occasionally
      if (Math.random() < 0.002) {
        let closest = null, minD = Infinity;
        for (const f of friendlyDrones) {
          const dx = drone.x - f.x, dy = drone.y - f.y;
          const d = dx * dx + dy * dy;
          if (d < minD) { minD = d; closest = f; }
        }
        if (closest && minD < 200 * 200) {
          drone.target = { x: closest.x, y: closest.y };
        } else {
          drone.target = this.objective;
        }
      } else if (!drone.target) {
        drone.target = this.objective;
      }

      drone.update(dt, force);
      this._clampToBounds(drone);
    });
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
