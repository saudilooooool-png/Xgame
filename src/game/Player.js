import {
  PLAYER_SPEED, PLAYER_WIDTH, PLAYER_HEIGHT,
  CANVAS_WIDTH, CANVAS_HEIGHT,
  BULLET_COOLDOWN_MS, PLAYER_INVINCIBLE_MS,
} from './constants.js';
import { Bullet } from './Bullet.js';

export class Player {
  constructor() {
    this.reset();
  }

  reset() {
    this.x = CANVAS_WIDTH / 2 - PLAYER_WIDTH / 2;
    this.y = CANVAS_HEIGHT - PLAYER_HEIGHT - 24;
    this.width = PLAYER_WIDTH;
    this.height = PLAYER_HEIGHT;
    this.lastShot = 0;
    this.invincibleUntil = 0;
  }

  get isInvincible() {
    return Date.now() < this.invincibleUntil;
  }

  makeInvincible() {
    this.invincibleUntil = Date.now() + PLAYER_INVINCIBLE_MS;
  }

  update(input, bullets, now) {
    if (input.left)  this.x = Math.max(0, this.x - PLAYER_SPEED);
    if (input.right) this.x = Math.min(CANVAS_WIDTH - this.width, this.x + PLAYER_SPEED);

    if (input.shoot && now - this.lastShot >= BULLET_COOLDOWN_MS) {
      bullets.push(new Bullet(
        this.x + this.width / 2 - 3,
        this.y,
        -1,
        'player'
      ));
      this.lastShot = now;
    }
  }

  draw(ctx, now) {
    const blinking = this.isInvincible && Math.floor(now / 100) % 2 === 0;
    if (blinking) return;

    ctx.save();
    ctx.fillStyle = '#00e5ff';
    ctx.shadowColor = '#00e5ff';
    ctx.shadowBlur = 12;

    // Body
    ctx.beginPath();
    ctx.moveTo(this.x + this.width / 2, this.y);
    ctx.lineTo(this.x + this.width, this.y + this.height);
    ctx.lineTo(this.x + this.width * 0.65, this.y + this.height * 0.75);
    ctx.lineTo(this.x + this.width * 0.35, this.y + this.height * 0.75);
    ctx.lineTo(this.x, this.y + this.height);
    ctx.closePath();
    ctx.fill();

    // Cockpit
    ctx.fillStyle = '#0a0a1a';
    ctx.beginPath();
    ctx.ellipse(
      this.x + this.width / 2,
      this.y + this.height * 0.45,
      this.width * 0.15,
      this.height * 0.18,
      0, 0, Math.PI * 2
    );
    ctx.fill();

    ctx.restore();
  }

  collidesWith(obj) {
    return (
      this.x < obj.x + obj.width &&
      this.x + this.width > obj.x &&
      this.y < obj.y + obj.height &&
      this.y + this.height > obj.y
    );
  }
}
