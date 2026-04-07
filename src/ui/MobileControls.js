/**
 * MobileControls — virtual on-screen buttons for touch devices.
 * Only injected when a touch device is detected.
 *
 * Layout (two rows at the bottom of the screen):
 *   Row 1 — Formations:  وتش | خنجر | درع | شبكة | نقطة
 *   Row 2 — Actions:     Tab(مجموعة) | S(تقسيم) | R(قائمة) | X(EMP) | G(برج)
 */
export class MobileControls {
  /** @param {import('../core/Game.js').Game} game */
  constructor(game) {
    this.game = game;
    this._el  = null;

    // Only inject on touch-capable devices
    if (!('ontouchstart' in window) && !navigator.maxTouchPoints) return;
    this._inject();
  }

  _inject() {
    const root = document.getElementById('game-container');
    const bar = document.createElement('div');
    bar.id = 'mc-bar';
    bar.className = 'mc-bar';

    // ── Row 1: Formation shortcuts ─────────────────────────────────────────
    const formations = [
      { key: 'z', label: 'وتش',  sub: 'WATCH'  },
      { key: 'c', label: 'خنجر', sub: 'DAGGER' },
      { key: 'v', label: 'درع',  sub: 'SHIELD' },
      { key: 'b', label: 'شبكة', sub: 'NET'    },
      { key: 'n', label: 'نقطة', sub: 'POINT'  },
    ];

    // ── Row 2: Action shortcuts ────────────────────────────────────────────
    const actions = [
      { key: 'Tab',   label: '⇄',  sub: 'مجموعة', special: true },
      { key: 's',     label: '✂',   sub: 'تقسيم'                 },
      { key: 'r',     label: '☰',   sub: 'قائمة'                 },
      { key: 'x',     label: '⚡',  sub: 'EMP'                    },
      { key: 'g',     label: '🏗',  sub: 'برج'                    },
    ];

    bar.innerHTML = `
      <div class="mc-row mc-row-formations">
        ${formations.map(f => `
          <button class="mc-btn mc-formation" data-key="${f.key}" aria-label="${f.label} ${f.sub}">
            <span class="mc-label">${f.label}</span>
            <span class="mc-sub">${f.sub}</span>
          </button>`).join('')}
      </div>
      <div class="mc-row mc-row-actions">
        ${actions.map(a => `
          <button class="mc-btn mc-action${a.special ? ' mc-special' : ''}" data-key="${a.key}" aria-label="${a.label} ${a.sub}">
            <span class="mc-label">${a.label}</span>
            <span class="mc-sub">${a.sub}</span>
          </button>`).join('')}
      </div>
    `;

    // Wire up touch handlers — fire synthetic keyboard events
    bar.addEventListener('touchstart', (e) => {
      const btn = e.target.closest('.mc-btn');
      if (!btn) return;
      e.preventDefault();
      e.stopPropagation();
      btn.classList.add('mc-active');
      this._fireKey(btn.dataset.key);
    }, { passive: false });

    bar.addEventListener('touchend', (e) => {
      const btn = e.target.closest('.mc-btn');
      if (btn) btn.classList.remove('mc-active');
    }, { passive: false });

    // Also support mouse clicks (desktop testing of mobile layout)
    bar.addEventListener('click', (e) => {
      const btn = e.target.closest('.mc-btn');
      if (!btn) return;
      e.stopPropagation();
      this._fireKey(btn.dataset.key);
    });

    root.appendChild(bar);
    this._el = bar;
  }

  _fireKey(key) {
    // Dispatch a real KeyboardEvent so Game.js keydown listeners pick it up
    const opts = { key, bubbles: true, cancelable: true };
    if (key === 'Tab') opts.code = 'Tab';
    window.dispatchEvent(new KeyboardEvent('keydown', opts));
  }

  /** Highlight the active formation button to match current game state. */
  update(currentFormation) {
    if (!this._el) return;
    const KEY_MAP = { watch: 'z', dagger: 'c', shield: 'v', net: 'b', point: 'n' };
    const activeKey = KEY_MAP[currentFormation];
    this._el.querySelectorAll('.mc-formation').forEach(btn => {
      btn.classList.toggle('mc-current', btn.dataset.key === activeKey);
    });
  }
}
