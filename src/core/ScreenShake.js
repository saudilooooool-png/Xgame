export class ScreenShake {
  constructor() {
    this.intensity = 0;
    this.duration = 0;
    this.offsetX = 0;
    this.offsetY = 0;
  }

  trigger(intensity = 8, duration = 0.3) {
    this.intensity = Math.max(this.intensity, intensity);
    this.duration = Math.max(this.duration, duration);
  }

  update(dt) {
    if (this.duration <= 0) {
      this.offsetX = 0;
      this.offsetY = 0;
      return;
    }
    this.duration -= dt;
    const mag = this.intensity * (this.duration > 0 ? this.duration : 0);
    this.offsetX = (Math.random() - 0.5) * mag;
    this.offsetY = (Math.random() - 0.5) * mag;
  }

  apply(ctx) {
    ctx.translate(this.offsetX, this.offsetY);
  }
}
