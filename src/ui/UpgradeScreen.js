/**
 * Between-wave upgrade & craft chooser — mobile-responsive
 *
 * Two rows:
 *   Row 1 — CRAFT   (build 2 specialised drones of one type)
 *   Row 2 — UPGRADE (global stat boosts or +5 standard drones)
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
      position: fixed; inset: 0;
      background: rgba(0,5,15,0.93);
      display: flex; flex-direction: column;
      align-items: center; justify-content: flex-start;
      z-index: 200;
      font-family: monospace;
      overflow-y: auto;
      -webkit-overflow-scrolling: touch;
      padding: 24px 12px 32px;
      animation: upgIn 0.3s ease;
    `;

    const style = document.createElement('style');
    style.textContent = `
      @keyframes upgIn { from { opacity:0; transform:scale(0.97) } to { opacity:1; transform:none } }
    `;
    document.head.appendChild(style);

    // ── Header ───────────────────────────────────────────────────────────────
    const title = document.createElement('div');
    title.style.cssText = 'color:#00d4ff; font-size:22px; letter-spacing:3px; margin-bottom:6px; text-align:center;';
    title.textContent = `WAVE ${wave} COMPLETE`;
    overlay.appendChild(title);

    const strip = document.createElement('div');
    strip.style.cssText = 'color:rgba(0,212,255,0.5); font-size:12px; letter-spacing:1px; margin-bottom:10px; text-align:center;';
    strip.textContent = `KILLS: ${stats.kills}   LOSSES: ${stats.losses}   SCORE: ${stats.score}`;
    overlay.appendChild(strip);

    // ── Perfect Wave badge ────────────────────────────────────────────────────
    if (stats.losses === 0) {
      const badge = document.createElement('div');
      badge.style.cssText = `
        color: #00ff88;
        font-size: 13px;
        font-weight: bold;
        letter-spacing: 2px;
        margin-bottom: 16px;
        text-align: center;
        text-shadow: 0 0 12px #00ff88, 0 0 24px #00ff44;
        animation: perfectPulse 1s ease-in-out infinite alternate;
      `;
      badge.textContent = '⭐ PERFECT WAVE — ZERO LOSSES ⭐';
      overlay.appendChild(badge);
      // Inject keyframes if not already added
      if (!document.getElementById('perfectPulseStyle')) {
        const pStyle = document.createElement('style');
        pStyle.id = 'perfectPulseStyle';
        pStyle.textContent = `
          @keyframes perfectPulse {
            from { opacity: 0.75; text-shadow: 0 0 8px #00ff88; }
            to   { opacity: 1.00; text-shadow: 0 0 20px #00ff88, 0 0 36px #00ff44; }
          }
        `;
        document.head.appendChild(pStyle);
      }
    } else {
      // Spacer to keep layout consistent
      const spacer = document.createElement('div');
      spacer.style.marginBottom = '16px';
      overlay.appendChild(spacer);
    }

    // ── Row 1 — CRAFT ────────────────────────────────────────────────────────
    overlay.appendChild(this._sectionLabel('CRAFT — نشر ٢ طائرات متخصصة', '#44ffcc'));

    const craftGrid = document.createElement('div');
    craftGrid.style.cssText = `
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 10px;
      width: 100%;
      max-width: 520px;
      margin-bottom: 22px;
    `;

    const craftOptions = [
      { key: 'craft_interceptor', ...ROLE_DISPLAY.interceptor },
      { key: 'craft_gunship',     ...ROLE_DISPLAY.gunship     },
      { key: 'craft_sentinel',    ...ROLE_DISPLAY.sentinel     },
    ];
    for (const opt of craftOptions) craftGrid.appendChild(this._card(opt));
    overlay.appendChild(craftGrid);

    // ── Row 2 — UPGRADE ──────────────────────────────────────────────────────
    overlay.appendChild(this._sectionLabel('UPGRADE — تعزيز عالمي', '#00d4ff'));

    const upgradeGrid = document.createElement('div');
    upgradeGrid.style.cssText = `
      display: grid;
      grid-template-columns: repeat(2, 1fr);
      gap: 10px;
      width: 100%;
      max-width: 360px;
    `;

    const upgradeOptions = [
      { key: 'drones',    icon: '⬡⬡⬡', label: '+5 STANDARD', desc: 'تعزيز السرب\nبـ٥ وحدات متوازنة', color: '#00d4ff' },
      { key: 'firepower', icon: '⚡',    label: '+30% FIREPOWER', desc: 'رفع ضرر\nجميع الطائرات ٣٠٪', color: '#ffcc00' },
      { key: 'speed',     icon: '▶▶',   label: '+20% SPEED',    desc: 'رفع سرعة\nجميع الطائرات ٢٠٪', color: '#00ff88' },
      { key: 'repair',    icon: '🔧',   label: 'EMERGENCY REPAIR', desc: '+٣٠ HP للمورد\nالأكثر تضرراً', color: '#ff8844' },
    ];
    for (const opt of upgradeOptions) upgradeGrid.appendChild(this._card(opt));
    overlay.appendChild(upgradeGrid);

    // ── Skip ─────────────────────────────────────────────────────────────────
    const skip = document.createElement('button');
    skip.style.cssText = `
      margin-top: 22px;
      background: transparent;
      color: rgba(255,255,255,0.2);
      border: none;
      font-family: monospace;
      font-size: 12px;
      cursor: pointer;
      letter-spacing: 1px;
      padding: 10px 20px;
      min-height: 44px;
      -webkit-tap-highlight-color: transparent;
    `;
    skip.textContent = 'SKIP';
    skip.addEventListener('click', () => this._choose('skip'));
    overlay.appendChild(skip);

    return overlay;
  }

  _sectionLabel(text, color) {
    const el = document.createElement('div');
    el.style.cssText = `
      color: ${color}; font-size: 11px; letter-spacing: 2px;
      opacity: 0.65; margin-bottom: 10px; text-align: center;
      width: 100%; max-width: 520px;
    `;
    el.textContent = text.toUpperCase();
    return el;
  }

  _card({ key, icon, label, desc, color }) {
    const card = document.createElement('button');
    card.style.cssText = `
      padding: 16px 10px;
      background: rgba(0,12,28,0.95);
      border: 1.5px solid ${color}33;
      border-radius: 12px;
      cursor: pointer;
      color: ${color};
      font-family: monospace;
      text-align: center;
      transition: border-color 0.15s, background 0.15s, transform 0.1s;
      outline: none;
      min-height: 110px;
      -webkit-tap-highlight-color: transparent;
    `;
    card.innerHTML = `
      <div style="font-size:22px; margin-bottom:8px;">${icon}</div>
      <div style="font-size:11px; letter-spacing:1px; margin-bottom:5px; font-weight:bold;">${label}</div>
      <div style="font-size:9px; color:rgba(255,255,255,0.38); line-height:1.5; white-space:pre-line;">${desc}</div>
    `;
    card.addEventListener('pointerenter', () => {
      card.style.borderColor = color;
      card.style.background  = `rgba(0,28,55,0.98)`;
      card.style.transform   = 'scale(1.03)';
    });
    card.addEventListener('pointerleave', () => {
      card.style.borderColor = `${color}33`;
      card.style.background  = `rgba(0,12,28,0.95)`;
      card.style.transform   = 'scale(1)';
    });
    card.addEventListener('click', () => this._choose(key));
    return card;
  }
}
