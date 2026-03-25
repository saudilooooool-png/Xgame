/**
 * ScoutIntro — pre-mission cinematic sequence (redesigned for clarity).
 *
 * The scout drone flies DIRECTLY to each objective the player must protect,
 * hovers for 2+ seconds with a labelled card, then visits the enemy base,
 * then returns to base. This teaches the player where their goals are BEFORE
 * the first wave starts.
 *
 * Flow:
 *   enter right → OBJECTIVE 1 (card) → OBJECTIVE 2 → OBJECTIVE 3
 *               → ENEMY BASE (warning) → return → game starts
 *
 * Each objective stop shows:
 *   • A pulsing highlight ring around the objective
 *   • A floating card: "هدف 1/3 · ⚡ الكهرباء · يجب الحماية!"
 *   • Expanding ping ring from the drone
 *   • Comms line logged to the panel
 *
 * Press Space / Enter to skip.
 */

const TWO_PI = Math.PI * 2;
const CARD_W = 200;
const CARD_H = 70;

export class ScoutIntro {
  /**
   * @param {Canvas}      canvas
   * @param {RadarSweep}  radarSweep
   * @param {Objective[]} objectives   live references — their x/y positions are used
   */
  constructor(canvas, radarSweep, objectives) {
    const W = canvas.width;
    const H = canvas.height;

    // ── Build waypoints from actual objective positions ────────────────────────
    this._waypoints = [
      { x: W * 1.06, y: H * 0.40 },                       // 0 — start off-screen
    ];

    objectives.forEach((obj, i) => {
      this._waypoints.push({
        x: obj.x,
        y: obj.y,
        hover: 2.2,
        msg:  `📍 هدف ${i + 1}: ${obj._label} ${obj._icon}`,
        card: {
          num:   `هدف ${i + 1} / ${objectives.length}`,
          icon:  obj._icon,
          name:  obj._label,
          note:  'يجب الحماية!',
          color: obj._color ?? '#00ff88',
        },
        objRef: obj,        // reference for highlight ring
      });
    });

    // Enemy base area (near top-center)
    this._waypoints.push({
      x: W * 0.50, y: H * 0.08,
      hover: 1.8,
      msg:  '⚡ القاعدة العدوة: درع نشط — ابحث عن نافذة هجوم',
      card: {
        num:   'تهديد رئيسي ⚠',
        icon:  '⚡',
        name:  'القاعدة المتقدمة',
        note:  'درع يدوم 15 ثانية',
        color: '#ff6600',
      },
    });

    // Return to player spawn
    this._waypoints.push({
      x: W * 0.50, y: H * 0.87,
      hover: 0.6,
      msg:  '✅ عودة — استعدوا للدفاع!',
    });

    // ── State ─────────────────────────────────────────────────────────────────
    this._x      = this._waypoints[0].x;
    this._y      = this._waypoints[0].y;
    this._wpIdx  = 0;
    this._speed  = 240;   // px / s
    this._hover  = 0;     // seconds remaining at current waypoint
    this._hoverWp = null; // waypoint we are hovering at (for card draw)

    this._trail  = [];    // { x, y, age }
    this._pings  = [];    // { x, y, age }
    this._comms  = [];    // { text, age }

    this._timer    = 0;
    this._endTimer = 0;
    this._done     = false;
    this._resolve  = null;
    this._radar    = radarSweep;

    // Opening comms queue: { at (seconds), text }
    this._queue = [
      { at: 0.10, text: '◌ تفعيل وحدة الاستطلاع...' },
      { at: 0.75, text: '◌ ربط بالرادار الرئيسي...' },
      { at: 1.40, text: '● الاتصال مؤكد  |  LINK ESTABLISHED' },
      { at: 2.00, text: '↗ فحص المنطقة — تحديد الأهداف' },
    ];
    this._endCommsAdded = false;

    // Radar entity for the scout itself
    this._radarEntity = {
      x: this._x, y: this._y,
      type: 'friendly', role: 'scout', dead: false,
      _teamColor: '#00ffcc', _radarShape: 'diamond', _vet: 0,
    };

    this._titleAlpha = 0;
  }

  // ── Public API ───────────────────────────────────────────────────────────────

  show() { return new Promise(r => { this._resolve = r; }); }
  skip() { if (!this._done) { this._done = true; this._resolve?.(); } }

  // ── Update ───────────────────────────────────────────────────────────────────

  update(dt) {
    if (this._done) return;
    this._timer += dt;

    // Title fade
    if (this._timer < 1.2)       this._titleAlpha = Math.min(1, this._timer / 0.5);
    else if (this._timer < 2.2)  this._titleAlpha = Math.max(0, 1 - (this._timer - 1.2));
    else                         this._titleAlpha = 0;

    // Queued comms
    while (this._queue.length && this._queue[0].at <= this._timer) {
      this._comms.push({ text: this._queue.shift().text, age: 0 });
    }

    // Age particles
    for (const pt of this._trail) pt.age += dt;
    this._trail = this._trail.filter(t => t.age < 1.0);

    for (const p of this._pings) p.age += dt;
    this._pings = this._pings.filter(p => p.age < 2.0);

    for (const c of this._comms) c.age += dt;

    // End sequence
    if (this._wpIdx >= this._waypoints.length) {
      if (!this._endCommsAdded) {
        this._endCommsAdded = true;
        this._comms.push({ text: '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━', age: 0 });
        this._comms.push({ text: '⚔  دافع عن المدينة — لا تسقط الأهداف', age: 0.25 });
        this._comms.push({ text: '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━', age: 0.50 });
      }
      this._endTimer += dt;
      if (this._endTimer > 2.4) { this._done = true; this._resolve?.(); }
      return;
    }

    // Hover at waypoint
    if (this._hover > 0) {
      this._hover -= dt;
      this._trail.push({ x: this._x, y: this._y, age: 0 });
      this._radarEntity.x = this._x;
      this._radarEntity.y = this._y;
      this._radar.forceReveal([this._radarEntity]);
      return;
    }

    // Move toward next waypoint
    const wp   = this._waypoints[this._wpIdx];
    const dx   = wp.x - this._x;
    const dy   = wp.y - this._y;
    const dist = Math.sqrt(dx * dx + dy * dy) || 0.001;

    if (dist < 12) {
      this._x = wp.x; this._y = wp.y;
      if (wp.msg)  this._comms.push({ text: wp.msg, age: 0 });
      if (wp.card || wp.hover > 0) {
        this._pings.push({ x: this._x, y: this._y, age: 0 });
        this._hoverWp = wp;
        this._hover   = wp.hover ?? 0;
      }
      this._wpIdx++;
    } else {
      const step = Math.min(dist, this._speed * dt);
      this._x += (dx / dist) * step;
      this._y += (dy / dist) * step;
      this._trail.push({ x: this._x, y: this._y, age: 0 });
    }

    this._radarEntity.x = this._x;
    this._radarEntity.y = this._y;
    this._radar.forceReveal([this._radarEntity]);
  }

  // ── Draw ─────────────────────────────────────────────────────────────────────

  draw(ctx, W, H) {
    const endFade = this._wpIdx >= this._waypoints.length
      ? Math.max(0, 1 - (this._endTimer - 1.0) / 1.4)
      : 1;

    ctx.save();

    // ── Mission title ─────────────────────────────────────────────────────────
    if (this._titleAlpha > 0.01) {
      ctx.globalAlpha = this._titleAlpha * endFade;
      ctx.font        = 'bold 24px monospace';
      ctx.textAlign   = 'center';
      ctx.fillStyle   = '#00ffcc';
      ctx.shadowColor = '#00ffcc';
      ctx.shadowBlur  = 22;
      ctx.fillText('مهمة استطلاعية', W / 2, H / 2 - 20);
      ctx.shadowBlur  = 0;
      ctx.font        = '12px monospace';
      ctx.globalAlpha = this._titleAlpha * 0.6 * endFade;
      ctx.fillStyle   = '#88ddcc';
      ctx.fillText('ADVANCE RECON  ·  تحديد الأهداف', W / 2, H / 2 + 8);
      ctx.textAlign   = 'left';
    }

    ctx.globalAlpha = endFade;

    // ── Objective highlight ring (while hovering at an objective) ─────────────
    if (this._hover > 0 && this._hoverWp?.card) {
      const wp   = this._hoverWp;
      const col  = wp.card.color ?? '#00ffcc';
      const beat = 0.5 + 0.5 * Math.sin(Date.now() / 340);

      // Large pulsing ring around the objective
      ctx.globalAlpha = (0.35 + 0.25 * beat) * endFade;
      ctx.strokeStyle = col;
      ctx.lineWidth   = 2.5;
      ctx.shadowColor = col;
      ctx.shadowBlur  = 18;
      ctx.beginPath();
      ctx.arc(wp.x, wp.y, 50 + 8 * beat, 0, TWO_PI);
      ctx.stroke();

      // Inner ring
      ctx.globalAlpha = (0.55 + 0.20 * beat) * endFade;
      ctx.lineWidth   = 1.5;
      ctx.shadowBlur  = 10;
      ctx.beginPath();
      ctx.arc(wp.x, wp.y, 30, 0, TWO_PI);
      ctx.stroke();
      ctx.shadowBlur  = 0;

      // Arrow line from card to objective
      const cardCX = W / 2;
      const cardBY = H / 2 + CARD_H / 2 + 14;
      ctx.globalAlpha = 0.35 * endFade;
      ctx.strokeStyle = col;
      ctx.lineWidth   = 1;
      ctx.setLineDash([4, 5]);
      ctx.beginPath();
      ctx.moveTo(cardCX, cardBY);
      ctx.lineTo(wp.x, wp.y);
      ctx.stroke();
      ctx.setLineDash([]);

      // Objective card
      this._drawObjectiveCard(ctx, W, H, wp.card, endFade);
    }

    // ── Trail ─────────────────────────────────────────────────────────────────
    for (const pt of this._trail) {
      const f = 1 - pt.age;
      ctx.globalAlpha = f * 0.50 * endFade;
      ctx.fillStyle   = '#00ffcc';
      ctx.shadowColor = '#00ffcc';
      ctx.shadowBlur  = 6;
      ctx.beginPath();
      ctx.arc(pt.x, pt.y, 2.5 * f + 0.4, 0, TWO_PI);
      ctx.fill();
    }
    ctx.shadowBlur = 0;

    // ── Ping rings ────────────────────────────────────────────────────────────
    for (const p of this._pings) {
      const t = p.age / 2.0;
      ctx.globalAlpha = (1 - t) * 0.60 * endFade;
      ctx.strokeStyle = '#00ffcc';
      ctx.lineWidth   = 1.5;
      ctx.shadowColor = '#00ffcc';
      ctx.shadowBlur  = 12;
      ctx.beginPath();
      ctx.arc(p.x, p.y, 8 + t * 80, 0, TWO_PI);
      ctx.stroke();
    }
    ctx.shadowBlur = 0;

    // ── Scout drone (diamond shape) ───────────────────────────────────────────
    if (this._wpIdx < this._waypoints.length) {
      const r     = 9;
      const blink = this._hover > 0 ? (Math.sin(Date.now() / 110) > 0 ? 1 : 0.5) : 1;
      ctx.globalAlpha = blink * endFade;
      ctx.fillStyle   = '#00ffcc';
      ctx.strokeStyle = 'rgba(255,255,255,0.85)';
      ctx.lineWidth   = 1.5;
      ctx.shadowColor = '#00ffcc';
      ctx.shadowBlur  = 24;
      ctx.beginPath();
      ctx.moveTo(this._x,     this._y - r * 1.5);
      ctx.lineTo(this._x + r, this._y);
      ctx.lineTo(this._x,     this._y + r * 1.5);
      ctx.lineTo(this._x - r, this._y);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      ctx.shadowBlur = 0;

      ctx.globalAlpha = 0.72 * endFade;
      ctx.font        = 'bold 8px monospace';
      ctx.textAlign   = 'center';
      ctx.fillStyle   = '#00ffcc';
      ctx.fillText('◆ SCOUT-1', this._x, this._y + r + 14);
      ctx.textAlign   = 'left';
    }

    // ── Comms panel ───────────────────────────────────────────────────────────
    this._drawCommsPanel(ctx, W, H, endFade);

    // ── Skip hint ─────────────────────────────────────────────────────────────
    ctx.globalAlpha = 0.28 * endFade;
    ctx.font        = '9px monospace';
    ctx.textAlign   = 'right';
    ctx.fillStyle   = '#aaaaaa';
    ctx.fillText('[Space / Enter] تخطي', W - 14, H - 14);
    ctx.textAlign   = 'left';

    ctx.globalAlpha = 1;
    ctx.restore();
  }

  // ── Objective card (center-screen, shown while hovering at a target) ─────────

  _drawObjectiveCard(ctx, W, H, card, masterAlpha) {
    const cX = W / 2;
    const cY = H / 2 - 10;

    ctx.save();
    ctx.globalAlpha = masterAlpha * 0.94;

    // Shadow backdrop
    ctx.fillStyle   = 'rgba(0,8,20,0.90)';
    ctx.strokeStyle = card.color;
    ctx.lineWidth   = 1.5;
    ctx.shadowColor = card.color;
    ctx.shadowBlur  = 16;
    ctx.beginPath();
    ctx.roundRect(cX - CARD_W / 2, cY - CARD_H / 2, CARD_W, CARD_H, 6);
    ctx.fill();
    ctx.stroke();
    ctx.shadowBlur = 0;

    // Num label (top)
    ctx.font        = 'bold 9px monospace';
    ctx.textAlign   = 'center';
    ctx.fillStyle   = card.color;
    ctx.globalAlpha = 0.75 * masterAlpha;
    ctx.fillText(card.num, cX, cY - CARD_H / 2 + 14);

    // Icon + name (center)
    ctx.globalAlpha = masterAlpha;
    ctx.font        = 'bold 15px monospace';
    ctx.fillStyle   = '#ffffff';
    ctx.fillText(`${card.icon}  ${card.name}`, cX, cY + 4);

    // Note (bottom)
    ctx.font        = '11px monospace';
    ctx.fillStyle   = card.color;
    ctx.globalAlpha = 0.90 * masterAlpha;
    ctx.fillText(card.note, cX, cY + CARD_H / 2 - 10);

    ctx.textAlign = 'left';
    ctx.restore();
  }

  // ── Comms terminal panel (bottom-left) ──────────────────────────────────────

  _drawCommsPanel(ctx, W, H, masterAlpha) {
    const MAX = 6;
    const lh  = 17;
    const pX  = 14;
    const pW  = 340;
    const lines = this._comms.slice(-MAX);
    const bodyH = lh * lines.length + 6;
    const hdrH  = 20;
    const totH  = bodyH + hdrH + 10;
    const pY    = H - 20;

    ctx.save();

    // Background
    ctx.globalAlpha = 0.90 * masterAlpha;
    ctx.fillStyle   = 'rgba(0,8,20,0.88)';
    ctx.strokeStyle = 'rgba(0,255,180,0.18)';
    ctx.lineWidth   = 1;
    ctx.beginPath();
    ctx.roundRect(pX - 8, pY - totH, pW + 16, totH + 4, 5);
    ctx.fill();
    ctx.stroke();

    // Header tint
    ctx.fillStyle = 'rgba(0,255,180,0.07)';
    ctx.fillRect(pX - 8, pY - totH, pW + 16, hdrH);

    ctx.globalAlpha = 0.52 * masterAlpha;
    ctx.font        = 'bold 8px monospace';
    ctx.fillStyle   = '#00ffcc';
    ctx.fillText('▌ قناة التشغيل المشترك  ·  JOINT OPS CHANNEL', pX, pY - totH + 13);

    // Lines
    lines.forEach((c, i) => {
      const isLast = i === lines.length - 1;
      const isSep  = c.text.startsWith('━');
      const fadeIn = Math.min(1, c.age * 5);
      ctx.globalAlpha = fadeIn * (isLast ? 0.95 : 0.70) * masterAlpha;
      ctx.font        = isSep ? '8px monospace' : '11px monospace';
      ctx.fillStyle   = isLast && !isSep ? '#00ffee'
                      : isSep            ? 'rgba(0,200,160,0.35)'
                      : c.text.startsWith('●') ? '#88ffcc'
                      : c.text.startsWith('⚔') ? '#ffcc44'
                      : '#55bbaa';
      const lineY = pY - bodyH + i * lh + lh - 4;
      ctx.fillText(c.text, pX, lineY);

      // Blinking cursor on newest line
      if (isLast && c.age < 1.6 && Math.sin(Date.now() / 220) > 0) {
        const tw = ctx.measureText(c.text).width;
        ctx.globalAlpha = 0.85 * masterAlpha;
        ctx.fillStyle   = '#00ffcc';
        ctx.fillText('█', pX + tw + 2, lineY);
      }
    });

    ctx.globalAlpha = 1;
    ctx.restore();
  }
}
