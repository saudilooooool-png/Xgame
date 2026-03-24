/**
 * ResourcesPanel — slide-up city resources dashboard.
 *
 * Shows the 3 city resources (⚡💧🌾) with live progress bars,
 * cascading-effect status, and tactical tips.
 * Toggled by a button in the Commander panel.
 */

const RES_INFO = {
  power: {
    icon: '⚡', label: 'الكهرباء', color: '#ffcc00', bgColor: 'rgba(255,200,0,0.08)',
    tips: [
      'احمِ محطة الكهرباء أولاً — الأعداء يستهدفونها في الموجات الأولى',
      'إذا انقطعت الكهرباء ستبدأ المياه بالنضوب تلقائياً',
    ],
    effects: {
      critical: '⚠ الرادار يضعف — الأعداء يصبحون أسرع',
      gone:     '✗ انقطع الكهرباء! المياه تنضب ٣/ث',
    },
  },
  water: {
    icon: '💧', label: 'المياه', color: '#00aaff', bgColor: 'rgba(0,170,255,0.08)',
    tips: [
      'المياه تعزز تحمّل الطائرات للمناطق الخطرة',
      'عند نضوبها تتضاعف أضرار مناطق الخطر',
    ],
    effects: {
      critical: '⚠ أضرار الخطر ×١.٥ — تجنّب المناطق الحمراء',
      gone:     '✗ نضبت المياه! الغذاء يتلف ٢/ث + خطر مضاعف',
    },
  },
  food: {
    icon: '🌾', label: 'الغذاء', color: '#88ff44', bgColor: 'rgba(136,255,68,0.08)',
    tips: [
      'الغذاء يحافظ على سرعة ومعنويات الطائرات',
      'عند نضوبه تتباطأ طائراتك وتفقد واحدة كل ٢٠ ثانية',
    ],
    effects: {
      critical: '⚠ الطائرات تتباطأ ١٥٪',
      gone:     '✗ نفد الغذاء! سرعة −٣٠٪، طائرة تموت كل ٢٠ث',
    },
  },
};

export class ResourcesPanel {
  constructor(game) {
    this.game = game;
    this._visible = false;
    this._el = null;
    this._interval = null;
    this._build();
  }

  toggle() {
    this._visible ? this.hide() : this.show();
  }

  show() {
    this._visible = true;
    this._el.style.transform = 'translateY(0)';
    this._el.style.opacity   = '1';
    this._el.style.pointerEvents = 'auto';
    this._refresh();
    this._interval = setInterval(() => this._refresh(), 250);
  }

  hide() {
    this._visible = false;
    this._el.style.transform = 'translateY(calc(100% + 20px))';
    this._el.style.opacity   = '0';
    this._el.style.pointerEvents = 'none';
    clearInterval(this._interval);
    this._interval = null;
  }

  _build() {
    const el = document.createElement('div');
    el.id = 'resources-panel';
    el.style.cssText = `
      position: fixed;
      bottom: 76px;
      left: 50%;
      transform: translateX(-50%) translateY(calc(100% + 20px));
      opacity: 0;
      pointer-events: none;
      transition: transform 0.32s cubic-bezier(0.34,1.3,0.64,1), opacity 0.22s ease;
      z-index: 150;
      width: min(480px, calc(100vw - 20px));
      background: rgba(4, 12, 28, 0.97);
      border: 1px solid rgba(0, 212, 255, 0.25);
      border-radius: 16px;
      padding: 16px;
      font-family: monospace;
      color: #00d4ff;
      backdrop-filter: blur(10px);
      -webkit-backdrop-filter: blur(10px);
      box-shadow: 0 -4px 40px rgba(0,0,0,0.6), 0 0 0 1px rgba(0,212,255,0.06);
    `;

    // Header
    el.innerHTML = `
      <div style="display:flex; align-items:center; justify-content:space-between; margin-bottom:14px;">
        <div style="font-size:14px; letter-spacing:2px; color:#00d4ff;">🏙 موارد المدينة</div>
        <button id="res-close" style="
          background:transparent; border:1px solid #ffffff22; border-radius:6px;
          color:#ffffff66; font-family:monospace; font-size:13px; cursor:pointer;
          padding:4px 10px; min-height:32px;
        ">✕</button>
      </div>
      <div id="res-body"></div>
    `;

    document.body.appendChild(el);
    this._el = el;
    this._body = el.querySelector('#res-body');

    el.querySelector('#res-close').addEventListener('click', () => this.hide());
  }

  _refresh() {
    const res = this.game.cityResources;
    const values = { power: res.power, water: res.water, food: res.food };
    const html = [];

    for (const [key, info] of Object.entries(RES_INFO)) {
      const val  = Math.max(0, values[key]);
      const pct  = val / 100;
      const barColor = pct > 0.6 ? info.color : pct > 0.3 ? '#ffaa00' : '#ff3344';
      const status   = this._statusLabel(key, val);
      const effect   = this._effectLabel(key, val, info);
      const tip      = info.tips[this.game.wave % info.tips.length] ?? info.tips[0];

      html.push(`
        <div style="
          background:${info.bgColor}; border:1px solid ${info.color}22;
          border-radius:10px; padding:12px 14px; margin-bottom:10px;
          ${pct <= 0.30 ? `box-shadow:0 0 12px ${info.color}22;` : ''}
        ">
          <div style="display:flex; align-items:center; gap:8px; margin-bottom:8px;">
            <span style="font-size:20px;">${info.icon}</span>
            <span style="font-size:13px; color:${info.color}; font-weight:bold;">${info.label}</span>
            <span style="margin-right:auto; font-size:12px; color:${barColor};">${status}</span>
            <span style="font-size:14px; font-weight:bold; color:${barColor};">${Math.ceil(val)}%</span>
          </div>

          <!-- Progress bar -->
          <div style="height:10px; background:rgba(255,255,255,0.08); border-radius:5px; overflow:hidden; margin-bottom:8px;">
            <div style="
              height:100%; width:${pct * 100}%;
              background:${barColor};
              border-radius:5px;
              transition: width 0.3s ease;
              ${pct <= 0.30 ? 'box-shadow:0 0 8px ' + barColor + ';' : ''}
            "></div>
          </div>

          ${effect ? `
            <div style="font-size:11px; color:${pct <= 0 ? '#ff4444' : '#ffaa00'}; margin-bottom:6px;">
              ${effect}
            </div>
          ` : ''}

          <div style="font-size:10px; color:rgba(255,255,255,0.35); border-top:1px solid rgba(255,255,255,0.06); padding-top:6px; margin-top:4px; direction:rtl; text-align:right;">
            💡 ${tip}
          </div>
        </div>
      `);
    }

    // City status line
    const totalPct = ((res.power + res.water + res.food) / 3).toFixed(0);
    const cityColor = totalPct > 60 ? '#00ff88' : totalPct > 30 ? '#ffaa00' : '#ff3344';
    html.push(`
      <div style="text-align:center; font-size:11px; color:${cityColor}; letter-spacing:1px; margin-top:4px;">
        صحة المدينة الكلية: ${totalPct}٪
        ${res.cityFallen() ? ' — <b style="color:#ff4444">المدينة سقطت</b>' : ''}
      </div>
    `);

    this._body.innerHTML = html.join('');
  }

  _statusLabel(key, val) {
    if (val <= 0)  return '✗ مدمر';
    if (val <= 30) return '⚠ خطر';
    if (val <= 60) return '⚡ تحت الضغط';
    return '✓ بخير';
  }

  _effectLabel(key, val, info) {
    if (val <= 0)  return info.effects.gone;
    if (val <= 30) return info.effects.critical;
    return '';
  }
}
