export class WaveAnnouncer {
  constructor() {
    this._text = '';
    this._alpha = 0;
    this._scale = 1;
    this._timer = 0;
  }

  announce(wave) {
    this._text = wave === 1 ? 'MISSION START' : `WAVE  ${wave}`;
    this._alpha = 1.0;
    this._scale = 1.6;
    this._timer = 2.2;
  }

  update(dt) {
    if (this._timer <= 0) return;
    this._timer -= dt;
    this._alpha = Math.min(1, this._timer / 0.5) * Math.min(1, (2.2 - (2.2 - this._timer)) / 0.3);
    this._scale = 1 + 0.6 * Math.max(0, this._timer / 2.2);
    if (this._timer <= 0) this._alpha = 0;
  }

  draw(ctx, canvasWidth, canvasHeight) {
    if (this._alpha <= 0) return;
    ctx.save();
    ctx.globalAlpha = this._alpha;
    ctx.font = `bold ${Math.floor(48 * this._scale)}px monospace`;
    ctx.textAlign = 'center';
    ctx.fillStyle = '#00d4ff';
    ctx.shadowColor = '#00d4ff';
    ctx.shadowBlur = 30;
    ctx.fillText(this._text, canvasWidth / 2, canvasHeight / 2);
    ctx.restore();
  }
}
