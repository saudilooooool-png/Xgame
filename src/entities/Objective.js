export class Objective {
  constructor(x, y) {
    this.x = x;
    this.y = y;
    this.health = 100;
    this._pulse = 0;
  }

  draw(ctx) {
    this._pulse = (this._pulse + 0.04) % (Math.PI * 2);
    const r = 28 + Math.sin(this._pulse) * 4;
    const healthColor = this.health > 60 ? '#00ff88' : this.health > 30 ? '#ffaa00' : '#ff3344';

    ctx.save();
    ctx.strokeStyle = healthColor;
    ctx.lineWidth = 2;
    ctx.shadowColor = healthColor;
    ctx.shadowBlur = 14;
    ctx.beginPath();
    ctx.arc(this.x, this.y, r, 0, Math.PI * 2);
    ctx.stroke();

    // inner dot
    ctx.fillStyle = healthColor;
    ctx.shadowBlur = 20;
    ctx.beginPath();
    ctx.arc(this.x, this.y, 6, 0, Math.PI * 2);
    ctx.fill();

    // health arc
    ctx.strokeStyle = healthColor;
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.arc(this.x, this.y, 38, -Math.PI / 2, -Math.PI / 2 + (2 * Math.PI * this.health) / 100);
    ctx.stroke();
    ctx.restore();
  }
}
