/**
 * ScoutIntro — pre-mission cinematic sequence.
 *
 * A single scout drone flies a reconnaissance path across the battlefield:
 *   off-screen right → NE scan → enemy-base area → NW scan
 *                    → objectives overview → player-base return
 *
 * As it flies it:
 *   • Appears as a moving diamond blip on the radar (forceReveal every frame)
 *   • Fires expanding ring "pings" at each waypoint
 *   • Logs messages in a terminal-style "Joint Ops Channel" panel
 *
 * Press Space / Enter to skip.
 * Returns a Promise that resolves when the sequence ends.
 */

const TWO_PI = Math.PI * 2;

export class ScoutIntro {
  /**
   * @param {Canvas}      canvas
   * @param {RadarSweep}  radarSweep
   * @param {Objective[]} objectives   — drawn so the city is visible
   */
  constructor(canvas, radarSweep, objectives) {
    const W = canvas.width;
    const H = canvas.height;

    // ── Waypoints ─────────────────────────────────────────────────────────────
    // Each entry: { x, y, msg?, hover? }
    // hover = extra pause at waypoint (seconds)
    this._waypoints = [
      { x: W * 1.06, y: H * 0.44 },                                       // 0 off-screen start
      { x: W * 0.80, y: H * 0.16, msg: '⚠ رصد حشد عدائي — الجانب الشرقي', hover: 0.5 },
      { x: W * 0.50, y: H * 0.07, msg: '⚡ القاعدة المتقدمة مكتشفة — درع نشط',  hover: 0.7 },
      { x: W * 0.20, y: H * 0.16, msg: '🏙 ثلاثة أهداف حيوية مؤكدة',           hover: 0.5 },
      { x: W * 0.50, y: H * 0.45, msg: '📡 إرسال خريطة التهديد للرادار الرئيسي', hover: 0.6 },
      { x: W * 0.50, y: H * 0.88, msg: '✅ عودة آمنة — كل الوحدات على الأهبة',  hover: 0.4 },
    ];

    // ── State ─────────────────────────────────────────────────────────────────
    this._x      = this._waypoints[0].x;
    this._y      = this._waypoints[0].y;
    this._wpIdx  = 0;
    this._speed  = 230;    // px / s while moving
    this._hover  = 0;      // countdown seconds at current waypoint

    this._trail   = [];    // { x, y, age }
    this._pings   = [];    // { x, y, age }
    this._comms   = [];    // { text, age }

    this._timer    = 0;    // wall clock since start
    this._endTimer = 0;    // counts after last waypoint reached
    this._done     = false;
    this._resolve  = null;

    this._radar    = radarSweep;

    // ── Pre-queued opening comms { text, at } ─────────────────────────────────
    // "at" = _timer value when the message should appear
    this._queue = [
      { at: 0.10, text: '◌ تفعيل قناة التشغيل المشترك...' },
      { at: 0.70, text: '◌ مزامنة مع الرادار الرئيسي...' },
      { at: 1.30, text: '● الاتصال مؤكد  |  LINK ESTABLISHED' },
      { at: 1.90, text: '↗ وحدة الاستطلاع في طريقها إلى المنطقة' },
    ];

    // End-sequence comms (added when last waypoint is reached)
    this._endCommsAdded = false;

    // Radar blip entity representing the scout
    this._radarEntity = {
      x: this._x, y: this._y,
      type: 'friendly', role: 'scout', dead: false,
      _teamColor: '#00ffcc', _radarShape: 'diamond', _vet: 0,
    };

    // Pre-draw title alpha
    this._titleAlpha = 0;
  }

  // ── Public API ───────────────────────────────────────────────────────────────

  /** Returns a Promise that resolves when the sequence finishes or is skipped. */
  show() {
    return new Promise(resolve => { this._resolve = resolve; });
  }

  /** Skip the intro immediately. */
  skip() {
    if (this._done) return;
    this._done = true;
    this._resolve?.();
  }

  // ── Update ───────────────────────────────────────────────────────────────────

  update(dt) {
    if (this._done) return;
    this._timer += dt;

    // ── Title fade in/out ─────────────────────────────────────────────────────
    if (this._timer < 1.5)      this._titleAlpha = Math.min(1, this._timer / 0.5);
    else if (this._timer < 2.5) this._titleAlpha = Math.max(0, 1 - (this._timer - 1.5));
    else                        this._titleAlpha = 0;

    // ── Queued opening comms ──────────────────────────────────────────────────
    while (this._queue.length && this._queue[0].at <= this._timer) {
      this._comms.push({ text: this._queue.shift().text, age: 0 });
    }

    // ── Age trail / pings / comms ─────────────────────────────────────────────
    for (const pt of this._trail) pt.age += dt;
    this._trail = this._trail.filter(t => t.age < 1.1);

    for (const p of this._pings) p.age += dt;
    this._pings = this._pings.filter(p => p.age < 2.0);

    for (const c of this._comms) c.age += dt;

    // ── End sequence ──────────────────────────────────────────────────────────
    if (this._wpIdx >= this._waypoints.length) {
      if (!this._endCommsAdded) {
        this._endCommsAdded = true;
        this._comms.push({ text: '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━', age: 0 });
        this._comms.push({ text: '⚔  مهمتك: صد الهجمات وحماية المدينة', age: 0.2 });
        this._comms.push({ text: '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━', age: 0.4 });
      }
      this._endTimer += dt;
      if (this._endTimer > 2.2) {
        this._done = true;
        this._resolve?.();
      }
      return;
    }

    // ── Hover at waypoint ─────────────────────────────────────────────────────
    if (this._hover > 0) {
      this._hover -= dt;
      this._trail.push({ x: this._x, y: this._y, age: 0 });  // still emit trail dots
      this._radarEntity.x = this._x;
      this._radarEntity.y = this._y;
      this._radar.forceReveal([this._radarEntity]);
      return;
    }

    // ── Move toward next waypoint ─────────────────────────────────────────────
    const wp   = this._waypoints[this._wpIdx];
    const dx   = wp.x - this._x;
    const dy   = wp.y - this._y;
    const dist = Math.sqrt(dx * dx + dy * dy) || 0.001;

    if (dist < 10) {
      // Arrived
      this._x = wp.x;
      this._y = wp.y;
      if (wp.msg) {
        this._comms.push({ text: wp.msg, age: 0 });
        this._pings.push({ x: this._x, y: this._y, age: 0 });
      }
      this._hover = wp.hover ?? 0;
      this._wpIdx++;
    } else {
      const step = Math.min(dist, this._speed * dt);
      this._x += (dx / dist) * step;
      this._y += (dy / dist) * step;
      this._trail.push({ x: this._x, y: this._y, age: 0 });
    }

    // Keep radar blip current
    this._radarEntity.x = this._x;
    this._radarEntity.y = this._y;
    this._radar.forceReveal([this._radarEntity]);
  }

  // ── Draw ─────────────────────────────────────────────────────────────────────

  draw(ctx, W, H) {
    // Global fade-out during end sequence
    const endFade = this._wpIdx >= this._waypoints.length
      ? Math.max(0, 1 - (this._endTimer - 1.2) / 1.0)
      : 1;

    ctx.save();

    // ── Mission title (fades in/out at start) ─────────────────────────────────
    if (this._titleAlpha > 0.01) {
      ctx.globalAlpha = this._titleAlpha * endFade;
      ctx.font        = 'bold 22px monospace';
      ctx.textAlign   = 'center';
      ctx.fillStyle   = '#00ffcc';
      ctx.shadowColor = '#00ffcc';
      ctx.shadowBlur  = 20;
      ctx.fillText('تقرير استطلاعي', W / 2, H / 2 - 16);
      ctx.shadowBlur = 0;
      ctx.font       = '11px monospace';
      ctx.globalAlpha = this._titleAlpha * 0.55 * endFade;
      ctx.fillStyle  = '#88ddcc';
      ctx.fillText('ADVANCE SCOUT REPORT  ·  قبل الهجوم', W / 2, H / 2 + 10);
      ctx.textAlign  = 'left';
    }

    ctx.globalAlpha = endFade;

    // ── Trail ─────────────────────────────────────────────────────────────────
    for (const pt of this._trail) {
      const f = 1 - pt.age / 1.1;
      ctx.globalAlpha = f * 0.55 * endFade;
      ctx.fillStyle   = '#00ffcc';
      ctx.shadowColor = '#00ffcc';
      ctx.shadowBlur  = 7;
      ctx.beginPath();
      ctx.arc(pt.x, pt.y, 2.5 * f + 0.5, 0, TWO_PI);
      ctx.fill();
    }
    ctx.shadowBlur = 0;

    // ── Waypoint ping rings ───────────────────────────────────────────────────
    for (const p of this._pings) {
      const t = p.age / 2.0;
      const r = 6 + t * 80;
      ctx.globalAlpha = (1 - t) * 0.65 * endFade;
      ctx.strokeStyle = '#00ffcc';
      ctx.lineWidth   = 1.5;
      ctx.shadowColor = '#00ffcc';
      ctx.shadowBlur  = 12;
      ctx.beginPath();
      ctx.arc(p.x, p.y, r, 0, TWO_PI);
      ctx.stroke();
    }
    ctx.shadowBlur = 0;

    // ── Scout drone (diamond) ─────────────────────────────────────────────────
    if (this._wpIdx < this._waypoints.length) {
      const r   = 9;
      const blink = this._hover > 0
        ? (Math.sin(Date.now() / 120) > 0 ? 1 : 0.55)
        : 1;
      ctx.globalAlpha = blink * endFade;
      ctx.fillStyle   = '#00ffcc';
      ctx.strokeStyle = 'rgba(255,255,255,0.85)';
      ctx.lineWidth   = 1.5;
      ctx.shadowColor = '#00ffcc';
      ctx.shadowBlur  = 24;
      ctx.beginPath();
      ctx.moveTo(this._x,         this._y - r * 1.5);
      ctx.lineTo(this._x + r,     this._y);
      ctx.lineTo(this._x,         this._y + r * 1.5);
      ctx.lineTo(this._x - r,     this._y);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      ctx.shadowBlur = 0;

      ctx.globalAlpha = 0.75 * endFade;
      ctx.font        = 'bold 8px monospace';
      ctx.textAlign   = 'center';
      ctx.fillStyle   = '#00ffcc';
      ctx.fillText('◆ SCOUT-1', this._x, this._y + r + 14);
      ctx.textAlign   = 'left';
    }

    // ── Joint Ops comms panel (bottom-left) ───────────────────────────────────
    this._drawCommsPanel(ctx, W, H, endFade);

    // ── Skip hint ─────────────────────────────────────────────────────────────
    if (endFade > 0.2) {
      ctx.globalAlpha = 0.28 * endFade;
      ctx.font        = '9px monospace';
      ctx.textAlign   = 'right';
      ctx.fillStyle   = '#aaaaaa';
      ctx.fillText('[Space / Enter] تخطي المقدمة', W - 16, H - 14);
      ctx.textAlign   = 'left';
    }

    ctx.globalAlpha = 1;
    ctx.restore();
  }

  _drawCommsPanel(ctx, W, H, masterAlpha) {
    const MAX  = 7;
    const lh   = 17;
    const pX   = 14;
    const pW   = 340;
    const lines = this._comms.slice(-MAX);
    const bodyH = lh * lines.length + 6;
    const hdrH  = 20;
    const totH  = bodyH + hdrH + 10;
    const pY    = H - 20;  // bottom of panel

    // Panel background
    ctx.globalAlpha = 0.90 * masterAlpha;
    ctx.fillStyle   = 'rgba(0,8,20,0.88)';
    ctx.strokeStyle = 'rgba(0,255,180,0.20)';
    ctx.lineWidth   = 1;
    ctx.beginPath();
    ctx.roundRect(pX - 8, pY - totH, pW + 16, totH + 4, 5);
    ctx.fill();
    ctx.stroke();

    // Header bar
    ctx.fillStyle = 'rgba(0,255,180,0.08)';
    ctx.fillRect(pX - 8, pY - totH, pW + 16, hdrH);

    ctx.globalAlpha = 0.55 * masterAlpha;
    ctx.font        = 'bold 8px monospace';
    ctx.fillStyle   = '#00ffcc';
    ctx.fillText('▌ قناة التشغيل المشترك  ·  JOINT OPS CHANNEL', pX, pY - totH + 13);

    // Comms lines
    lines.forEach((c, i) => {
      const isLast  = i === lines.length - 1;
      const fadeIn  = Math.min(1, c.age * 5);
      ctx.globalAlpha = fadeIn * (isLast ? 0.95 : 0.72) * masterAlpha;

      const isSep   = c.text.startsWith('━');
      ctx.font      = isSep ? '8px monospace' : '11px monospace';
      ctx.fillStyle = isLast && !isSep ? '#00ffee'
                    : isSep            ? 'rgba(0,200,160,0.4)'
                    : c.text.startsWith('●') ? '#88ffcc'
                    : c.text.startsWith('⚔') ? '#ffcc44'
                    : '#55bbaa';

      const lineY = pY - bodyH + i * lh + lh - 4;
      ctx.fillText(c.text, pX, lineY);

      // Blinking cursor on the newest line while it's fresh
      if (isLast && c.age < 1.8 && Math.sin(Date.now() / 220) > 0) {
        const tw = ctx.measureText(c.text).width;
        ctx.globalAlpha = 0.85 * masterAlpha;
        ctx.fillStyle   = '#00ffcc';
        ctx.fillText('█', pX + tw + 2, lineY);
      }
    });

    ctx.globalAlpha = 1;
  }
}
