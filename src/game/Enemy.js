import { ENEMY_WIDTH, ENEMY_HEIGHT } from './constants.js';
import { Bullet } from './Bullet.js';

// type: 0 = grunt, 1 = soldier, 2 = commander, 3 = boss-row
const TYPE_COLORS = ['#ff4081', '#ff9800', '#e040fb', '#f44336'];
const TYPE_SCORES = [10, 20, 30, 40];

export class Enemy {
  constructor(col, row, x, y, type) {
    this.col = col;
    this.row = row;
    this.x = x;
    this.y = y;
    this.width = ENEMY_WIDTH;
    this.height = ENEMY_HEIGHT;
    this.type = type;
    this.active = true;
    this.animFrame = 0;
    this.animTimer = 0;
  }

  get scoreValue() {
    return TYPE_SCORES[this.type] ?? 10;
  }

  update(dt) {
    this.animTimer += dt;
    if (this.animTimer > 500) {
      this.animFrame ^= 1;
      this.animTimer = 0;
    }
  }

  tryShoot(bullets, chance) {
    if (Math.random() < chance) {
      bullets.push(new Bullet(
        this.x + this.width / 2 - 3,
        this.y + this.height,
        1,
        'enemy'
      ));
    }
  }

  draw(ctx) {
    const color = TYPE_COLORS[this.type] ?? '#ff4081';
    ctx.save();
    ctx.fillStyle = color;
    ctx.shadowColor = color;
    ctx.shadowBlur = 10;

    const cx = this.x + this.width / 2;
    const cy = this.y + this.height / 2;
    const w = this.width;
    const h = this.height;

    if (this.type === 3) {
      // Boss-row: large diamond
      ctx.beginPath();
      ctx.moveTo(cx, cy - h * 0.55);
      ctx.lineTo(cx + w * 0.5, cy);
      ctx.lineTo(cx, cy + h * 0.55);
      ctx.lineTo(cx - w * 0.5, cy);
      ctx.closePath();
      ctx.fill();
    } else if (this.type === 2) {
      // Commander: hexagon
      ctx.beginPath();
      for (let i = 0; i < 6; i++) {
        const angle = (Math.PI / 3) * i - Math.PI / 6;
        const px = cx + Math.cos(angle) * w * 0.45;
        const py = cy + Math.sin(angle) * h * 0.45;
        i === 0 ? ctx.moveTo(px, py) : ctx.lineTo(px, py);
      }
      ctx.closePath();
      ctx.fill();
    } else {
      // Standard alien body
      const legOffset = this.animFrame === 0 ? 4 : -4;
      ctx.beginPath();
      ctx.roundRect(cx - w * 0.38, cy - h * 0.3, w * 0.76, h * 0.6, 4);
      ctx.fill();
      // Eyes
      ctx.fillStyle = '#0a0a1a';
      ctx.fillRect(cx - w * 0.22, cy - h * 0.1, w * 0.12, h * 0.2);
      ctx.fillRect(cx + w * 0.1, cy - h * 0.1, w * 0.12, h * 0.2);
      // Legs
      ctx.fillStyle = color;
      ctx.fillRect(cx - w * 0.38, cy + h * 0.2, 4, h * 0.25 + legOffset);
      ctx.fillRect(cx - w * 0.1, cy + h * 0.2, 4, h * 0.25 - legOffset);
      ctx.fillRect(cx + w * 0.1 - 2, cy + h * 0.2, 4, h * 0.25 + legOffset);
      ctx.fillRect(cx + w * 0.28, cy + h * 0.2, 4, h * 0.25 - legOffset);
    }

    ctx.restore();
  }
}
