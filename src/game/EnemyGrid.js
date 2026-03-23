import {
  ENEMY_ROWS, ENEMY_COLS,
  ENEMY_WIDTH, ENEMY_HEIGHT,
  ENEMY_H_GAP, ENEMY_V_GAP,
  ENEMY_DROP, ENEMY_BASE_SPEED, ENEMY_SPEED_INCREMENT,
  ENEMY_SHOOT_CHANCE,
  CANVAS_WIDTH,
  PARTICLE_COUNT,
} from './constants.js';
import { Enemy } from './Enemy.js';
import { Particle } from './Particle.js';

const GRID_TOP = 60;
const GRID_LEFT = 40;

export class EnemyGrid {
  constructor(wave) {
    this.direction = 1; // 1 = right, -1 = left
    this.speed = ENEMY_BASE_SPEED + (wave - 1) * ENEMY_SPEED_INCREMENT;
    this.enemies = [];
    this._init();
  }

  _init() {
    const typeMap = [3, 2, 1, 0]; // row 0 = top = boss type
    for (let r = 0; r < ENEMY_ROWS; r++) {
      for (let c = 0; c < ENEMY_COLS; c++) {
        const x = GRID_LEFT + c * (ENEMY_WIDTH + ENEMY_H_GAP);
        const y = GRID_TOP + r * (ENEMY_HEIGHT + ENEMY_V_GAP);
        this.enemies.push(new Enemy(c, r, x, y, typeMap[r]));
      }
    }
  }

  get alive() {
    return this.enemies.some(e => e.active);
  }

  get count() {
    return this.enemies.filter(e => e.active).length;
  }

  _bounds() {
    const active = this.enemies.filter(e => e.active);
    if (!active.length) return null;
    return {
      left:   Math.min(...active.map(e => e.x)),
      right:  Math.max(...active.map(e => e.x + e.width)),
      bottom: Math.max(...active.map(e => e.y + e.height)),
    };
  }

  update(dt, bullets, particles) {
    const bounds = this._bounds();
    if (!bounds) return;

    let drop = false;
    if (this.direction === 1 && bounds.right >= CANVAS_WIDTH - 10) {
      this.direction = -1;
      drop = true;
    } else if (this.direction === -1 && bounds.left <= 10) {
      this.direction = 1;
      drop = true;
    }

    // Speed scales as enemies are destroyed
    const ratio = this.count / (ENEMY_ROWS * ENEMY_COLS);
    const currentSpeed = this.speed + (1 - ratio) * 2;

    for (const enemy of this.enemies) {
      if (!enemy.active) continue;
      enemy.x += this.direction * currentSpeed;
      if (drop) enemy.y += ENEMY_DROP;
      enemy.update(dt);
      enemy.tryShoot(bullets, ENEMY_SHOOT_CHANCE);
    }
  }

  checkBulletHits(bullets, onKill) {
    for (const bullet of bullets) {
      if (!bullet.active || bullet.owner !== 'player') continue;
      for (const enemy of this.enemies) {
        if (!enemy.active) continue;
        if (
          bullet.x < enemy.x + enemy.width &&
          bullet.x + bullet.width > enemy.x &&
          bullet.y < enemy.y + enemy.height &&
          bullet.y + bullet.height > enemy.y
        ) {
          bullet.active = false;
          enemy.active = false;
          onKill(enemy);
          break;
        }
      }
    }
  }

  spawnParticles(enemy, particles) {
    const TYPE_COLORS = ['#ff4081', '#ff9800', '#e040fb', '#f44336'];
    const color = TYPE_COLORS[enemy.type] ?? '#ff4081';
    for (let i = 0; i < PARTICLE_COUNT; i++) {
      particles.push(new Particle(
        enemy.x + enemy.width / 2,
        enemy.y + enemy.height / 2,
        color
      ));
    }
  }

  hasReachedBottom(threshold) {
    return this.enemies.some(e => e.active && e.y + e.height >= threshold);
  }
}
