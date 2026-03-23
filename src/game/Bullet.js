import { BULLET_SPEED } from './constants.js';

export class Bullet {
  constructor(x, y, direction, owner) {
    this.x = x;
    this.y = y;
    this.width = 6;
    this.height = 14;
    this.vy = BULLET_SPEED * direction;
    this.owner = owner; // 'player' | 'enemy'
    this.active = true;
  }

  update() {
    this.y += this.vy;
    if (this.y < -this.height || this.y > 620) {
      this.active = false;
    }
  }

  draw(ctx) {
    ctx.save();
    const color = this.owner === 'player' ? '#00e5ff' : '#ff4081';
    ctx.fillStyle = color;
    ctx.shadowColor = color;
    ctx.shadowBlur = 8;
    ctx.fillRect(this.x, this.y, this.width, this.height);
    ctx.restore();
  }
}
