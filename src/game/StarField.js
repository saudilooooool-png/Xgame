import { STAR_COUNT, CANVAS_WIDTH, CANVAS_HEIGHT } from './constants.js';

export class StarField {
  constructor() {
    this.stars = Array.from({ length: STAR_COUNT }, () => ({
      x: Math.random() * CANVAS_WIDTH,
      y: Math.random() * CANVAS_HEIGHT,
      speed: Math.random() * 0.8 + 0.2,
      size: Math.random() * 2 + 0.5,
      alpha: Math.random() * 0.7 + 0.3,
    }));
  }

  update() {
    for (const s of this.stars) {
      s.y += s.speed;
      if (s.y > CANVAS_HEIGHT) {
        s.y = 0;
        s.x = Math.random() * CANVAS_WIDTH;
      }
    }
  }

  draw(ctx) {
    ctx.save();
    for (const s of this.stars) {
      ctx.globalAlpha = s.alpha;
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(s.x, s.y, s.size, s.size);
    }
    ctx.globalAlpha = 1;
    ctx.restore();
  }
}
