export class WaveAnnouncer {
  constructor() {
    this._text = '';
    this._alpha = 0;
    this._scale = 1;
    this._timer = 0;
  }

  announce(wave, isBossWave = false) {
    if (wave === 1)           this._text = 'MISSION START';
    else if (isBossWave)      this._text = `⚡ BOSS WAVE  ${wave}`;
    else                      this._text = `WAVE  ${wave}`;
    this._isBoss = isBossWave;
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
    const color = this._isBoss ? '#ffcc00' : '#00d4ff';
    ctx.fillStyle = color;
    ctx.shadowColor = this._isBoss ? '#ff8800' : '#00d4ff';
    ctx.shadowBlur = this._isBoss ? 45 : 30;
    ctx.fillText(this._text, canvasWidth / 2, canvasHeight / 2);
    // Sub-label for boss
    if (this._isBoss) {
      ctx.font = `bold ${Math.floor(18 * this._scale * 0.45)}px monospace`;
      ctx.shadowBlur = 12;
      ctx.fillStyle = '#ffaa44';
      ctx.fillText('HEAVY UNIT INCOMING', canvasWidth / 2, canvasHeight / 2 + Math.floor(36 * this._scale * 0.5));
    }
    ctx.restore();
  }
}
