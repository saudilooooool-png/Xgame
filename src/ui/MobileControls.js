/**
 * MobileControls — touch-first command system.
 *
 * Features:
 *  1. Radial command wheel — long-press (420ms) on game canvas opens a pie
 *     menu with 8 slices. Drag to a slice and release to fire it.
 *  2. Multi-finger gestures — 2-finger tap = switch group (Tab),
 *     3-finger tap = split/merge (S).
 *  3. Simple formation quick-bar at bottom (visible, smaller than before)
 *     for players who prefer tapping rather than the radial wheel.
 *
 * The virtual joystick is handled entirely in Commander.js.
 */

const SLICES = [
  { key: 'z',   icon: '⬡',  ar: 'وتش',   en: 'WATCH',  color: '#00e87a' },
  { key: 'c',   icon: '▲',  ar: 'خنجر',  en: 'DAGGER', color: '#ff6644' },
  { key: 'v',   icon: '⬡',  ar: 'درع',   en: 'SHIELD', color: '#44aaff' },
  { key: 'b',   icon: '⬟',  ar: 'شبكة',  en: 'NET',    color: '#ffdd44' },
  { key: 'n',   icon: '●',  ar: 'نقطة',  en: 'POINT',  color: '#ff44cc' },
  { key: 'Tab', icon: '⇄',  ar: 'مجموعة', en: 'GROUP',  color: '#aaddff' },
  { key: 'x',   icon: '⚡',  ar: 'EMP',   en: 'EMP',    color: '#00ddff' },
  { key: 'g',   icon: '🏗', ar: 'برج',   en: 'TOWER',  color: '#ffcc00' },
];

const WHEEL_R       = 92;    // px — distance from center to slice button center
const LONG_PRESS_MS = 420;   // ms — hold duration to open wheel
const DRAG_CANCEL   = 18;    // px — movement before long-press is cancelled

export class MobileControls {
  /** @param {import('../core/Game.js').Game} game */
  constructor(game) {
    this.game       = game;
    this._barEl     = null;
    this._wheelEl   = null;
    this._wheelOpen = false;
    this._longTimer = null;
    this._lpStartX  = 0;
    this._lpStartY  = 0;
    this._selected  = -1;      // index into SLICES, -1 = none

    const isTouch = ('ontouchstart' in window) || navigator.maxTouchPoints > 0;
    if (!isTouch) return;

    this._injectBar();
    this._injectWheel();
    this._bindGestures();
  }

  // ── Formation quick-bar (compact, single row) ──────────────────────────────

  _injectBar() {
    const root = document.getElementById('game-container');

    const bar = document.createElement('div');
    bar.id        = 'mc-bar';
    bar.className = 'mc-bar';

    const formations = [
      { key: 'z', ar: 'وتش',  en: 'WATCH'  },
      { key: 'c', ar: 'خنجر', en: 'DAGGER' },
      { key: 'v', ar: 'درع',  en: 'SHIELD' },
      { key: 'b', ar: 'شبكة', en: 'NET'    },
      { key: 'n', ar: 'نقطة', en: 'POINT'  },
    ];

    // Single compact row — formations only
    bar.innerHTML = `
      <div class="mc-row mc-row-formations">
        ${formations.map(f => `
          <button class="mc-btn mc-formation" data-key="${f.key}">
            <span class="mc-label">${f.ar}</span>
            <span class="mc-sub">${f.en}</span>
          </button>`).join('')}
        <button class="mc-btn mc-action mc-special" data-key="Tab" title="مجموعة">
          <span class="mc-label">⇄</span>
          <span class="mc-sub">GRP</span>
        </button>
        <button class="mc-btn mc-action" data-key="s" title="تقسيم">
          <span class="mc-label">✂</span>
          <span class="mc-sub">SPLIT</span>
        </button>
      </div>
      <div class="mc-hint">⟲ اضغط مطوّلاً لفتح قائمة الأوامر</div>
    `;

    bar.addEventListener('touchstart', (e) => {
      const btn = e.target.closest('.mc-btn');
      if (!btn) return;
      e.preventDefault();
      e.stopPropagation();
      btn.classList.add('mc-active');
      this._fireKey(btn.dataset.key);
    }, { passive: false });

    bar.addEventListener('touchend', (e) => {
      e.target.closest('.mc-btn')?.classList.remove('mc-active');
    }, { passive: true });

    // Desktop click fallback
    bar.addEventListener('click', (e) => {
      const btn = e.target.closest('.mc-btn');
      if (btn) { e.stopPropagation(); this._fireKey(btn.dataset.key); }
    });

    root.appendChild(bar);
    this._barEl = bar;
  }

  // ── Radial command wheel ───────────────────────────────────────────────────

  _injectWheel() {
    const root = document.getElementById('game-container');

    const wheel = document.createElement('div');
    wheel.id        = 'mc-wheel';
    wheel.className = 'mc-wheel hidden';

    // Center label
    const centerLabel = document.createElement('div');
    centerLabel.className = 'mc-wheel-center';
    centerLabel.textContent = '✕';
    wheel.appendChild(centerLabel);

    // Slice buttons placed in a ring
    SLICES.forEach((s, i) => {
      const angle = (i / SLICES.length) * Math.PI * 2 - Math.PI / 2;
      const bx    = Math.cos(angle) * WHEEL_R;
      const by    = Math.sin(angle) * WHEEL_R;

      const btn = document.createElement('div');
      btn.className    = 'mc-slice';
      btn.dataset.idx  = i;
      btn.dataset.key  = s.key;
      btn.style.cssText = `
        left: calc(50% + ${bx.toFixed(1)}px);
        top:  calc(50% + ${by.toFixed(1)}px);
        --slice-color: ${s.color};
      `;
      btn.innerHTML = `
        <span class="mc-slice-icon">${s.icon}</span>
        <span class="mc-slice-ar">${s.ar}</span>
        <span class="mc-slice-en">${s.en}</span>
      `;
      wheel.appendChild(btn);
    });

    root.appendChild(wheel);
    this._wheelEl = wheel;
  }

  // ── Gesture detection ──────────────────────────────────────────────────────

  _bindGestures() {
    const canvas = document.getElementById('game-container');

    // Listen on document to catch multi-finger events regardless of source
    document.addEventListener('touchstart', (e) => {
      const tc = e.touches.length;

      // ── Long-press detection (single finger only) ────────────────────────
      if (tc === 1 && !this._wheelOpen) {
        const t = e.touches[0];
        this._lpStartX = t.clientX;
        this._lpStartY = t.clientY;
        this._longTimer = setTimeout(() => {
          this._openWheel(this._lpStartX, this._lpStartY);
        }, LONG_PRESS_MS);
      }

      // ── Multi-finger: cancel long-press ───────────────────────────────────
      if (tc > 1) this._cancelLongPress();

    }, { passive: true });

    document.addEventListener('touchmove', (e) => {
      // Cancel long-press if finger moved too far
      if (this._longTimer && e.touches.length === 1) {
        const t  = e.touches[0];
        const dx = t.clientX - this._lpStartX;
        const dy = t.clientY - this._lpStartY;
        if (dx * dx + dy * dy > DRAG_CANCEL * DRAG_CANCEL) {
          this._cancelLongPress();
        }
      }

      // ── Update wheel selection while dragging ───────────────────────────
      if (this._wheelOpen && e.touches.length === 1) {
        const t = e.touches[0];
        this._updateWheelSelection(t.clientX, t.clientY);
      }
    }, { passive: true });

    document.addEventListener('touchend', (e) => {
      const wasOpen = this._wheelOpen;

      // ── Confirm wheel slice on lift ──────────────────────────────────────
      if (wasOpen) {
        if (this._selected >= 0) {
          this._fireKey(SLICES[this._selected].key);
        }
        this._closeWheel();
        this._cancelLongPress();
        return;
      }

      this._cancelLongPress();

      // ── Multi-finger taps ────────────────────────────────────────────────
      // Count how many fingers lifted simultaneously (changedTouches)
      const lifted = e.changedTouches.length;
      if (lifted === 2) {
        // 2-finger tap → switch group
        this._fireKey('Tab');
      } else if (lifted >= 3) {
        // 3-finger tap → split/merge
        this._fireKey('s');
      }
    }, { passive: true });
  }

  // ── Wheel helpers ──────────────────────────────────────────────────────────

  _openWheel(cx, cy) {
    if (!this._wheelEl) return;
    this._wheelOpen = true;
    this._selected  = -1;

    // Position centered on long-press point, clamped to viewport
    const el = this._wheelEl;
    const margin = WHEEL_R + 50;
    const px = Math.min(Math.max(cx, margin), window.innerWidth  - margin);
    const py = Math.min(Math.max(cy, margin), window.innerHeight - margin);

    el.style.left = `${px}px`;
    el.style.top  = `${py}px`;
    el.classList.remove('hidden');
    el.classList.add('mc-wheel-open');

    // Store wheel center in client coords
    this._wheelCX = px;
    this._wheelCY = py;
  }

  _closeWheel() {
    if (!this._wheelEl) return;
    this._wheelOpen = false;
    this._selected  = -1;
    this._wheelEl.classList.remove('mc-wheel-open');
    this._wheelEl.classList.add('hidden');
    // Clear all slice highlights
    this._wheelEl.querySelectorAll('.mc-slice').forEach(s =>
      s.classList.remove('mc-slice-active')
    );
  }

  _updateWheelSelection(tx, ty) {
    if (!this._wheelEl) return;
    const dx    = tx - this._wheelCX;
    const dy    = ty - this._wheelCY;
    const dist  = Math.sqrt(dx * dx + dy * dy);

    if (dist < 28) {
      // Inside center — no selection
      this._selected = -1;
      this._wheelEl.querySelectorAll('.mc-slice').forEach(s =>
        s.classList.remove('mc-slice-active')
      );
      return;
    }

    // Find nearest slice by angle
    const angle = Math.atan2(dy, dx) + Math.PI / 2;   // offset to match top=0
    const norm  = ((angle % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2);
    const idx   = Math.round(norm / (Math.PI * 2) * SLICES.length) % SLICES.length;

    if (idx !== this._selected) {
      this._selected = idx;
      this._wheelEl.querySelectorAll('.mc-slice').forEach((s, i) =>
        s.classList.toggle('mc-slice-active', i === idx)
      );
    }
  }

  _cancelLongPress() {
    if (this._longTimer) {
      clearTimeout(this._longTimer);
      this._longTimer = null;
    }
  }

  // ── Shared key dispatch ────────────────────────────────────────────────────

  _fireKey(key) {
    const opts = { key, bubbles: true, cancelable: true };
    if (key === 'Tab') opts.code = 'Tab';
    window.dispatchEvent(new KeyboardEvent('keydown', opts));
  }

  // ── Per-frame update — highlight active formation in bar ───────────────────

  update(currentFormation) {
    if (!this._barEl) return;
    const KEY_MAP = { watch: 'z', dagger: 'c', shield: 'v', net: 'b', point: 'n' };
    const activeKey = KEY_MAP[currentFormation];
    this._barEl.querySelectorAll('.mc-formation').forEach(btn =>
      btn.classList.toggle('mc-current', btn.dataset.key === activeKey)
    );
  }
}
