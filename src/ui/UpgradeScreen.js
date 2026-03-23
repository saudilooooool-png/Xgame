/**
 * Between-wave upgrade chooser
 *
 * Shows 3 upgrade options after each wave.
 * Player must pick one before the next wave spawns.
 */
export class UpgradeScreen {
  constructor() {
    this._el = null;
    this._resolve = null;
  }

  /**
   * Show the screen. Returns a Promise that resolves with the chosen upgrade key.
   * @param {number} wave  — wave just completed
   * @param {object} stats — { kills, losses, score }
   */
  show(wave, stats) {
    return new Promise((resolve) => {
      this._resolve = resolve;
      this._el = this._build(wave, stats);
      document.body.appendChild(this._el);
    });
  }

  _choose(key) {
    if (this._el) { document.body.removeChild(this._el); this._el = null; }
    if (this._resolve) { this._resolve(key); this._resolve = null; }
  }

  _build(wave, stats) {
    const overlay = document.createElement('div');
    overlay.style.cssText = `
      position:fixed; inset:0; background:rgba(0,5,15,0.88);
      display:flex; flex-direction:column; align-items:center;
      justify-content:center; z-index:200; font-family:monospace;
    `;

    // Title
    const title = document.createElement('div');
    title.style.cssText = `
      color:#00d4ff; font-size:22px; letter-spacing:3px; margin-bottom:6px;
    `;
    title.textContent = `WAVE ${wave} COMPLETE`;
    overlay.appendChild(title);

    // Stats strip
    const strip = document.createElement('div');
    strip.style.cssText = `
      color:rgba(0,212,255,0.5); font-size:12px; letter-spacing:1px; margin-bottom:32px;
    `;
    strip.textContent = `KILLS: ${stats.kills}   LOSSES: ${stats.losses}   SCORE: ${stats.score}`;
    overlay.appendChild(strip);

    const subtitle = document.createElement('div');
    subtitle.style.cssText = `
      color:rgba(255,255,255,0.5); font-size:12px; letter-spacing:2px; margin-bottom:24px;
    `;
    subtitle.textContent = 'CHOOSE AN UPGRADE';
    overlay.appendChild(subtitle);

    // Options
    const options = [
      {
        key: 'drones',
        icon: '⬡⬡⬡',
        label: '+5 DRONES',
        desc: 'Reinforce your swarm\nwith 5 additional units',
        color: '#00d4ff',
      },
      {
        key: 'firepower',
        icon: '⚡',
        label: '+30% FIREPOWER',
        desc: 'Boost all drone damage\nby 30% this session',
        color: '#ffaa00',
      },
      {
        key: 'speed',
        icon: '▶▶',
        label: '+20% SPEED',
        desc: 'Increase max speed\nof all your drones by 20%',
        color: '#00ff88',
      },
    ];

    const row = document.createElement('div');
    row.style.cssText = 'display:flex; gap:16px;';

    for (const opt of options) {
      const card = document.createElement('button');
      card.style.cssText = `
        width:180px; padding:24px 16px;
        background:rgba(0,15,30,0.95);
        border:1px solid ${opt.color}44;
        border-radius:10px; cursor:pointer;
        color:${opt.color}; font-family:monospace;
        text-align:center; transition:border-color 0.15s, background 0.15s;
        outline:none;
      `;

      card.innerHTML = `
        <div style="font-size:26px; margin-bottom:10px;">${opt.icon}</div>
        <div style="font-size:14px; letter-spacing:1.5px; margin-bottom:8px;">${opt.label}</div>
        <div style="font-size:10px; color:rgba(255,255,255,0.45); line-height:1.5; white-space:pre-line;">${opt.desc}</div>
      `;

      card.addEventListener('mouseenter', () => {
        card.style.borderColor = opt.color;
        card.style.background = `rgba(0,30,60,0.98)`;
      });
      card.addEventListener('mouseleave', () => {
        card.style.borderColor = `${opt.color}44`;
        card.style.background = `rgba(0,15,30,0.95)`;
      });
      card.addEventListener('click', () => this._choose(opt.key));

      row.appendChild(card);
    }

    overlay.appendChild(row);

    // Skip hint
    const skip = document.createElement('div');
    skip.style.cssText = `
      margin-top:20px; color:rgba(255,255,255,0.2);
      font-size:11px; cursor:pointer; letter-spacing:1px;
    `;
    skip.textContent = 'SKIP';
    skip.addEventListener('click', () => this._choose('skip'));
    overlay.appendChild(skip);

    return overlay;
  }
}
