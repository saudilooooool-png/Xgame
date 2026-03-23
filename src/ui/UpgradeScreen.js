/**
 * Between-wave upgrade & craft chooser
 *
 * Two rows:
 *   Row 1 — CRAFT   (build 2 specialised drones of one type)
 *   Row 2 — UPGRADE (global stat boosts or +5 standard drones)
 *
 * Player picks exactly one card before the next wave spawns.
 */
import { ROLE_DISPLAY } from '../entities/FriendlyRoles.js';

export class UpgradeScreen {
  constructor() {
    this._el = null;
    this._resolve = null;
  }

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
      position:fixed; inset:0; background:rgba(0,5,15,0.90);
      display:flex; flex-direction:column; align-items:center;
      justify-content:center; z-index:200; font-family:monospace;
    `;

    // ── Header ─────────────────────────────────────────────────────────────
    const title = document.createElement('div');
    title.style.cssText = `color:#00d4ff; font-size:22px; letter-spacing:3px; margin-bottom:6px;`;
    title.textContent = `WAVE ${wave} COMPLETE`;
    overlay.appendChild(title);

    const strip = document.createElement('div');
    strip.style.cssText = `color:rgba(0,212,255,0.5); font-size:12px; letter-spacing:1px; margin-bottom:28px;`;
    strip.textContent = `KILLS: ${stats.kills}   LOSSES: ${stats.losses}   SCORE: ${stats.score}`;
    overlay.appendChild(strip);

    // ── Row 1 — CRAFT ──────────────────────────────────────────────────────
    overlay.appendChild(this._sectionLabel('CRAFT — deploy 2 specialised drones', '#44ffcc'));

    const craftRow = document.createElement('div');
    craftRow.style.cssText = 'display:flex; gap:12px; margin-bottom:24px;';

    const craftOptions = [
      { key: 'craft_interceptor', ...ROLE_DISPLAY.interceptor },
      { key: 'craft_gunship',     ...ROLE_DISPLAY.gunship     },
      { key: 'craft_sentinel',    ...ROLE_DISPLAY.sentinel     },
    ];
    for (const opt of craftOptions) {
      craftRow.appendChild(this._card(opt));
    }
    overlay.appendChild(craftRow);

    // ── Row 2 — UPGRADE ────────────────────────────────────────────────────
    overlay.appendChild(this._sectionLabel('UPGRADE — global stat boost', '#00d4ff'));

    const upgradeRow = document.createElement('div');
    upgradeRow.style.cssText = 'display:flex; gap:12px;';

    const upgradeOptions = [
      {
        key: 'drones',
        icon: '⬡⬡⬡',
        label: '+5 STANDARD',
        desc: 'Reinforce swarm\nwith 5 balanced units',
        color: '#00d4ff',
      },
      {
        key: 'firepower',
        icon: '⚡',
        label: '+30% FIREPOWER',
        desc: 'Boost all drone\ndamage by 30%',
        color: '#ffcc00',
      },
      {
        key: 'speed',
        icon: '▶▶',
        label: '+20% SPEED',
        desc: 'Increase max speed\nof all drones by 20%',
        color: '#00ff88',
      },
    ];
    for (const opt of upgradeOptions) {
      upgradeRow.appendChild(this._card(opt));
    }
    overlay.appendChild(upgradeRow);

    // ── Skip ───────────────────────────────────────────────────────────────
    const skip = document.createElement('div');
    skip.style.cssText = `margin-top:20px; color:rgba(255,255,255,0.2);
      font-size:11px; cursor:pointer; letter-spacing:1px;`;
    skip.textContent = 'SKIP';
    skip.addEventListener('click', () => this._choose('skip'));
    overlay.appendChild(skip);

    return overlay;
  }

  _sectionLabel(text, color) {
    const el = document.createElement('div');
    el.style.cssText = `color:${color}; font-size:11px; letter-spacing:2px;
      opacity:0.6; margin-bottom:10px; text-align:center;`;
    el.textContent = text.toUpperCase();
    return el;
  }

  _card({ key, icon, label, desc, color }) {
    const card = document.createElement('button');
    card.style.cssText = `
      width:168px; padding:18px 14px;
      background:rgba(0,15,30,0.95);
      border:1px solid ${color}44;
      border-radius:10px; cursor:pointer;
      color:${color}; font-family:monospace;
      text-align:center; transition:border-color 0.15s, background 0.15s;
      outline:none;
    `;
    card.innerHTML = `
      <div style="font-size:24px; margin-bottom:8px;">${icon}</div>
      <div style="font-size:12px; letter-spacing:1.5px; margin-bottom:6px;">${label}</div>
      <div style="font-size:9px; color:rgba(255,255,255,0.40); line-height:1.5; white-space:pre-line;">${desc}</div>
    `;
    card.addEventListener('mouseenter', () => {
      card.style.borderColor = color;
      card.style.background  = `rgba(0,30,60,0.98)`;
    });
    card.addEventListener('mouseleave', () => {
      card.style.borderColor = `${color}44`;
      card.style.background  = `rgba(0,15,30,0.95)`;
    });
    card.addEventListener('click', () => this._choose(key));
    return card;
  }
}
