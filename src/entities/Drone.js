export class Drone {
  constructor(x, y, type = 'friendly') {
    this.x = x;
    this.y = y;
    this.vx = (Math.random() - 0.5) * 40;
    this.vy = (Math.random() - 0.5) * 40;
    this.type = type;
    this.target = null; // {x, y} formation target
    this.trail = [];
    this.angle = 0;
    this.maxSpeed = type === 'friendly' ? 130 : 90;
  }

  update(dt, force) {
    this.vx += force.fx * this.maxSpeed * dt * 60;
    this.vy += force.fy * this.maxSpeed * dt * 60;

    // clamp speed
    const spd = Math.sqrt(this.vx * this.vx + this.vy * this.vy);
    if (spd > this.maxSpeed) {
      this.vx = (this.vx / spd) * this.maxSpeed;
      this.vy = (this.vy / spd) * this.maxSpeed;
    }

    this.x += this.vx * dt;
    this.y += this.vy * dt;

    if (spd > 5) this.angle = Math.atan2(this.vy, this.vx);

    // trail
    this.trail.push({ x: this.x, y: this.y });
    if (this.trail.length > 8) this.trail.shift();
  }

  draw(ctx) {
    // trail
    if (this.trail.length > 1) {
      ctx.save();
      for (let i = 1; i < this.trail.length; i++) {
        const alpha = (i / this.trail.length) * 0.3;
        ctx.strokeStyle = this.type === 'friendly'
          ? `rgba(0,200,255,${alpha})`
          : `rgba(255,60,60,${alpha})`;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(this.trail[i - 1].x, this.trail[i - 1].y);
        ctx.lineTo(this.trail[i].x, this.trail[i].y);
        ctx.stroke();
      }
      ctx.restore();
    }

    ctx.save();
    ctx.translate(this.x, this.y);
    ctx.rotate(this.angle);

    if (this.type === 'friendly') {
      ctx.fillStyle = '#00d4ff';
      ctx.shadowColor = '#00d4ff';
      ctx.shadowBlur = 8;
    } else {
      ctx.fillStyle = '#ff3c3c';
      ctx.shadowColor = '#ff3c3c';
      ctx.shadowBlur = 8;
    }

    // arrow shape
    ctx.beginPath();
    ctx.moveTo(8, 0);
    ctx.lineTo(-5, -4);
    ctx.lineTo(-3, 0);
    ctx.lineTo(-5, 4);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }
}
