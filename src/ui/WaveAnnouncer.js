/**
 * WaveAnnouncer — full-screen wave announcement with story narrative.
 *
 * Layers (top → bottom):
 *   1. Main wave label (big, scale-in)
 *   2. Arabic chapter title (medium)
 *   3. Narrative subtitle (small, faded)
 *   4. Urgent resource warnings (red, if any)
 *   5. Streak badge (yellow, if streak ≥ 2)
 */
export class WaveAnnouncer {
  constructor() {
    this._alpha  = 0;
    this._scale  = 1;
    this._timer  = 0;
    this._story  = null;
    this._wave   = 0;
    this._isBoss = false;
  }

  /**
   * @param {number} wave
   * @param {boolean} isBossWave
   * @param {object} story  — from getWaveStory()
   * @param {number} streak — current perfect-wave streak
   */
  announce(wave, isBossWave = false, story = null, streak = 0) {
    this._wave   = wave;
    this._isBoss = isBossWave;
    this._story  = story;
    this._streak = streak;
    this._alpha  = 1.0;
    this._scale  = 1.7;
    this._timer  = 3.0;   // show for 3 seconds
  }

  update(dt) {
    if (this._timer <= 0) return;
    this._timer -= dt;
    // Fade in fast (0-0.3s), hold, fade out last 0.6s
    const fadeIn  = Math.min(1, (3.0 - this._timer) / 0.25);
    const fadeOut = Math.min(1, this._timer / 0.6);
    this._alpha   = Math.min(fadeIn, fadeOut);
    this._scale   = 1 + 0.7 * Math.max(0, this._timer / 3.0);
    if (this._timer <= 0) this._alpha = 0;
  }

  draw(ctx, W, H) {
    if (this._alpha <= 0) return;
    const s = this._story;
    const cx = W / 2;

    ctx.save();
    ctx.globalAlpha = this._alpha;
    ctx.textAlign   = 'center';

    // ── Main wave label ──────────────────────────────────────────────────
    const isBoss  = this._isBoss;
    const mainColor  = isBoss ? '#ffcc00' : '#00d4ff';
    const mainShadow = isBoss ? '#ff8800' : '#00d4ff';
    const mainText   = this._wave === 1
      ? 'MISSION START'
      : isBoss
        ? `⚡ BOSS WAVE  ${this._wave}`
        : `WAVE  ${this._wave}`;

    ctx.font        = `bold ${Math.floor(52 * Math.min(this._scale, 1.5))}px monospace`;
    ctx.fillStyle   = mainColor;
    ctx.shadowColor = mainShadow;
    ctx.shadowBlur  = isBoss ? 55 : 35;
    ctx.fillText(mainText, cx, H * 0.42);

    if (!s) { ctx.restore(); return; }

    // ── Arabic chapter title ─────────────────────────────────────────────
    const titleY = H * 0.42 + 46;
    ctx.font      = `bold 22px monospace`;
    ctx.fillStyle = s.color ?? mainColor;
    ctx.shadowColor = s.color ?? mainColor;
    ctx.shadowBlur  = 18;
    ctx.fillText(s.arTitle, cx, titleY);

    // ── English subtitle (small) ─────────────────────────────────────────
    if (s.enTitle && this._wave > 1) {
      ctx.font      = '13px monospace';
      ctx.fillStyle = 'rgba(255,255,255,0.35)';
      ctx.shadowBlur = 0;
      ctx.fillText(s.enTitle, cx, titleY + 22);
    }

    // ── Narrative description ────────────────────────────────────────────
    if (s.sub) {
      ctx.font      = '13px monospace';
      ctx.fillStyle = 'rgba(255,255,255,0.60)';
      ctx.shadowBlur = 0;
      // Word-wrap manually for long Arabic text
      this._drawWrapped(ctx, s.sub, cx, titleY + 50, W * 0.62, 18);
    }

    // ── Urgent resource warnings ─────────────────────────────────────────
    if (s.urgentLines?.length) {
      let uy = titleY + 50 + (s.sub ? 40 : 0);
      ctx.font      = 'bold 12px monospace';
      ctx.shadowColor = '#ff4444';
      ctx.shadowBlur  = 10;
      for (const line of s.urgentLines) {
        ctx.fillStyle = '#ff4444';
        ctx.fillText(line, cx, uy);
        uy += 18;
      }
    }

    // ── Streak badge ─────────────────────────────────────────────────────
    if (s.streakBonus) {
      const badgeY = H * 0.42 - 54;
      ctx.font      = 'bold 16px monospace';
      ctx.fillStyle = '#ffcc00';
      ctx.shadowColor = '#ff8800';
      ctx.shadowBlur  = 20;
      ctx.fillText(s.streakBonus, cx, badgeY);
    }

    ctx.restore();
  }

  /** Simple word-wrap for canvas text (splits on spaces). */
  _drawWrapped(ctx, text, cx, y, maxW, lineH) {
    const words = text.split(' ');
    let line = '';
    let row  = 0;
    for (const w of words) {
      const test = line ? `${line} ${w}` : w;
      if (ctx.measureText(test).width > maxW && line) {
        ctx.fillText(line, cx, y + row * lineH);
        line = w;
        row++;
      } else {
        line = test;
      }
    }
    if (line) ctx.fillText(line, cx, y + row * lineH);
  }
}
