import { TARGET_LIST } from '../entities/TargetTypes.js';
import { buildDefenseProfile } from '../ai/DefenderAI.js';

const DRONE_DEFS = [
  { role: 'standard',    icon: '◈', label: 'Standard',    cost: 1, color: '#00d4ff', desc: 'متوازن — الوحدة الأساسية\n100 HP | 130 سرعة | 40 ضرر' },
  { role: 'interceptor', icon: '▲', label: 'Interceptor', cost: 2, color: '#44ffcc', desc: 'سريع وخفيف — يصطاد الرشاشين\n75 HP  | 170 سرعة | 28 ضرر' },
  { role: 'gunship',     icon: '◆', label: 'Gunship',     cost: 3, color: '#ffaa00', desc: 'قوة نارية عالية — يضرب الأهداف الثقيلة\n130 HP | 88 سرعة  | 58 ضرر' },
  { role: 'sentinel',    icon: '⬡', label: 'Sentinel',    cost: 2, color: '#88ff44', desc: 'دفاع طويل المدى — خط المواجهة\n165 HP | 58 سرعة  | 24 ضرر' },
];

const APPROACH_DIRS = [
  { id: 'top',    label: 'شمال', icon: '↑' },
  { id: 'right',  label: 'شرق',  icon: '→' },
  { id: 'bottom', label: 'جنوب', icon: '↓' },
  { id: 'left',   label: 'غرب',  icon: '←' },
];

const BUDGET = 20;

export class MissionSetupScreen {
  show() {
    return new Promise((resolve) => {
      this._resolve = resolve;
      this._step = 1;
      this._selectedTarget = null;
      this._loadout = { standard: 0, interceptor: 0, gunship: 0, sentinel: 0 };
      this._remaining = BUDGET;
      this._selectedApproach = null;

      this._el = document.createElement('div');
      this._el.style.cssText = `
        position: fixed; inset: 0;
        display: flex; flex-direction: column;
        align-items: center; justify-content: flex-start;
        background: rgba(0,4,12,0.97);
        z-index: 300;
        font-family: monospace;
        color: #00d4ff;
        overflow-y: auto;
        -webkit-overflow-scrolling: touch;
        padding: 16px 8px 24px;
        animation: mssIn 0.35s ease;
      `;

      const style = document.createElement('style');
      style.textContent = `
        @keyframes mssIn  { from { opacity:0; transform:translateY(16px) } to { opacity:1; transform:none } }
        @keyframes mssOut { to   { opacity:0; pointer-events:none } }

        .mss-card {
          background: rgba(0,20,40,0.85);
          border: 1.5px solid rgba(0,212,255,0.15);
          border-radius: 12px;
          padding: 16px 14px;
          cursor: pointer;
          transition: all 0.15s;
          text-align: center;
          -webkit-tap-highlight-color: transparent;
        }
        .mss-card:active  { background: rgba(0,60,100,0.55); }
        .mss-card.selected {
          border-color: #00d4ff;
          background: rgba(0,120,200,0.28);
          box-shadow: 0 0 20px rgba(0,212,255,0.22);
        }

        .mss-btn {
          background: rgba(0,20,40,0.92);
          color: #00d4ff;
          border: 1.5px solid rgba(0,212,255,0.5);
          border-radius: 10px;
          padding: 14px 32px;
          font-size: 15px;
          cursor: pointer;
          font-family: monospace;
          letter-spacing: 1px;
          transition: all 0.15s;
          width: 100%;
          max-width: 340px;
          margin-top: 18px;
          min-height: 50px;
          -webkit-tap-highlight-color: transparent;
        }
        .mss-btn:active  { background: rgba(0,180,255,0.22); }
        .mss-btn:disabled { opacity: 0.3; cursor: not-allowed; }

        .mss-back {
          background: transparent;
          color: rgba(0,212,255,0.4);
          border: none;
          font-family: monospace;
          font-size: 13px;
          cursor: pointer;
          margin-top: 10px;
          padding: 8px 16px;
          min-height: 44px;
          letter-spacing: 1px;
          -webkit-tap-highlight-color: transparent;
        }

        /* Counter buttons — large touch targets */
        .mss-cb {
          background: rgba(0,20,40,0.9);
          color: #00d4ff;
          border: 1.5px solid rgba(0,212,255,0.35);
          border-radius: 8px;
          width: 40px;
          height: 40px;
          font-size: 20px;
          cursor: pointer;
          font-family: monospace;
          transition: all 0.1s;
          display: flex; align-items: center; justify-content: center;
          flex-shrink: 0;
          -webkit-tap-highlight-color: transparent;
        }
        .mss-cb:active  { background: rgba(0,180,255,0.22); }
        .mss-cb:disabled { opacity: 0.2; cursor: not-allowed; }

        /* Steps progress indicator */
        .mss-steps { display:flex; gap:8px; margin:12px 0 20px; }
        .mss-step  {
          width:32px; height:4px; border-radius:2px;
          background: rgba(0,212,255,0.2);
          transition: background 0.3s;
        }
        .mss-step.active  { background: #00d4ff; }
        .mss-step.done    { background: rgba(0,212,255,0.5); }
      `;
      document.head.appendChild(style);
      document.body.appendChild(this._el);
      this._renderStep();
    });
  }

  _stepsIndicator(current) {
    const wrap = document.createElement('div');
    wrap.className = 'mss-steps';
    for (let i = 1; i <= 3; i++) {
      const d = document.createElement('div');
      d.className = `mss-step ${i < current ? 'done' : i === current ? 'active' : ''}`;
      wrap.appendChild(d);
    }
    return wrap;
  }

  _renderStep() {
    this._el.innerHTML = '';
    if (this._step === 1) this._renderTargetStep();
    else if (this._step === 2) this._renderLoadoutStep();
    else if (this._step === 3) this._renderApproachStep();
    else this._renderAnalysisStep();
  }

  // ── Step 1: Target ──────────────────────────────────────────────────────────
  _renderTargetStep() {
    const wrap = this._makeWrap('اختر الهدف', 'الخطوة ١ من ٣');
    wrap.appendChild(this._stepsIndicator(1));

    const grid = document.createElement('div');
    grid.style.cssText = `
      display: grid;
      grid-template-columns: repeat(2, 1fr);
      gap: 10px;
      width: 100%;
      max-width: 460px;
      margin-top: 4px;
    `;

    for (const t of TARGET_LIST) {
      const card = document.createElement('div');
      card.className = `mss-card${this._selectedTarget === t.id ? ' selected' : ''}`;
      card.innerHTML = `
        <div style="font-size:30px; margin-bottom:8px;">${t.icon}</div>
        <div style="font-size:13px; color:${t.color}; font-weight:bold; margin-bottom:4px;">${t.label}</div>
        <div style="font-size:10px; color:#aaa; line-height:1.5;">${t.desc}</div>
        <div style="font-size:11px; color:#ffcc00; margin-top:8px; font-weight:bold;">×${t.scoreMulti} نقاط</div>
      `;
      card.addEventListener('click', () => {
        this._selectedTarget = t.id;
        this._renderStep();
      });
      grid.appendChild(card);
    }

    wrap.appendChild(grid);

    const btn = this._makeBtn('التالي: بناء السرب ›');
    btn.disabled = !this._selectedTarget;
    btn.addEventListener('click', () => { this._step = 2; this._renderStep(); });
    wrap.appendChild(btn);
    this._el.appendChild(wrap);
  }

  // ── Step 2: Loadout ─────────────────────────────────────────────────────────
  _renderLoadoutStep() {
    const wrap = this._makeWrap('جهّز أسرابك', 'الخطوة ٢ من ٣');
    wrap.appendChild(this._stepsIndicator(2));

    // Budget indicator
    const budgetEl = document.createElement('div');
    budgetEl.style.cssText = `
      background: rgba(255,200,0,0.08); border: 1px solid rgba(255,200,0,0.25);
      border-radius: 8px; padding: 8px 16px; margin-bottom: 12px;
      font-size: 13px; color: #ffcc00; text-align: center; width: 100%; max-width: 460px;
    `;
    budgetEl.innerHTML = `الميزانية: <b style="font-size:16px">${this._remaining}</b> / ${BUDGET} نقطة`;
    wrap.appendChild(budgetEl);

    const grid = document.createElement('div');
    grid.style.cssText = `
      display: grid;
      grid-template-columns: repeat(2, 1fr);
      gap: 10px;
      width: 100%;
      max-width: 460px;
    `;

    for (const def of DRONE_DEFS) {
      const count = this._loadout[def.role];
      const card = document.createElement('div');
      card.className = 'mss-card';
      card.style.cssText += 'cursor:default;';
      card.innerHTML = `
        <div style="font-size:24px; color:${def.color}; margin-bottom:6px;">${def.icon}</div>
        <div style="font-size:12px; color:${def.color}; font-weight:bold;">${def.label}</div>
        <div style="font-size:9px; color:#777; margin:4px 0; white-space:pre-line; line-height:1.5;">${def.desc}</div>
        <div style="font-size:10px; color:#ffcc00; margin-bottom:8px;">تكلفة: ${def.cost} نقطة</div>
        <div style="display:flex; align-items:center; justify-content:center; gap:10px;">
          <button class="mss-cb" id="dec-${def.role}" ${count === 0 ? 'disabled' : ''}>−</button>
          <span style="font-size:18px; min-width:26px; text-align:center; color:#fff; font-weight:bold;"
                id="cnt-${def.role}">${count}</span>
          <button class="mss-cb" id="inc-${def.role}" ${this._remaining < def.cost ? 'disabled' : ''}>+</button>
        </div>
      `;
      grid.appendChild(card);
    }

    wrap.appendChild(grid);

    const totalDrones = Object.values(this._loadout).reduce((s, v) => s + v, 0);
    const summary = document.createElement('div');
    summary.style.cssText = 'font-size:12px; color:#00d4ff66; margin-top:12px; text-align:center;';
    summary.textContent = totalDrones > 0 ? `إجمالي الدرونز: ${totalDrones}` : 'اختر درونز للمتابعة';
    wrap.appendChild(summary);

    const btn = this._makeBtn('التالي: جهة الهجوم ›');
    btn.disabled = totalDrones === 0;
    btn.addEventListener('click', () => { this._step = 3; this._renderStep(); });
    wrap.appendChild(btn);

    const back = this._makeBackBtn();
    back.addEventListener('click', () => { this._step = 1; this._renderStep(); });
    wrap.appendChild(back);

    this._el.appendChild(wrap);

    // Bind counter buttons
    for (const def of DRONE_DEFS) {
      document.getElementById(`inc-${def.role}`)?.addEventListener('click', () => {
        if (this._remaining >= def.cost) {
          this._loadout[def.role]++;
          this._remaining -= def.cost;
          this._renderStep();
        }
      });
      document.getElementById(`dec-${def.role}`)?.addEventListener('click', () => {
        if (this._loadout[def.role] > 0) {
          this._loadout[def.role]--;
          this._remaining += def.cost;
          this._renderStep();
        }
      });
    }
  }

  // ── Step 3: Approach direction ──────────────────────────────────────────────
  _renderApproachStep() {
    const wrap = this._makeWrap('اختر جهة الهجوم', 'الخطوة ٣ من ٣');
    wrap.appendChild(this._stepsIndicator(3));

    const sub = document.createElement('div');
    sub.style.cssText = 'font-size:11px; color:rgba(0,212,255,0.45); margin-bottom:16px; text-align:center;';
    sub.textContent = 'سرية تامة — المدافع لا يعرف من أين ستهجم';
    wrap.appendChild(sub);

    const grid = document.createElement('div');
    grid.style.cssText = `
      display: grid;
      grid-template-columns: repeat(2, 1fr);
      gap: 10px;
      width: 100%;
      max-width: 300px;
    `;

    for (const dir of APPROACH_DIRS) {
      const card = document.createElement('div');
      card.className = `mss-card${this._selectedApproach === dir.id ? ' selected' : ''}`;
      card.innerHTML = `
        <div style="font-size:32px; margin-bottom:6px;">${dir.icon}</div>
        <div style="font-size:13px; color:#00d4ff;">${dir.label}</div>
      `;
      card.addEventListener('click', () => {
        this._selectedApproach = dir.id;
        this._renderStep();
      });
      grid.appendChild(card);
    }

    wrap.appendChild(grid);

    const btn = this._makeBtn('ابدأ التحليل ►');
    btn.disabled = !this._selectedApproach;
    btn.addEventListener('click', () => { this._step = 4; this._renderStep(); });
    wrap.appendChild(btn);

    const back = this._makeBackBtn();
    back.addEventListener('click', () => { this._step = 2; this._renderStep(); });
    wrap.appendChild(back);

    this._el.appendChild(wrap);
  }

  // ── Step 4: Defender analysis ───────────────────────────────────────────────
  _renderAnalysisStep() {
    const profile = buildDefenseProfile(this._loadout, this._selectedTarget, this._selectedApproach);
    const wrap = this._makeWrap('تحليل المدافع...', '');
    wrap.style.maxWidth = '480px';

    const bar = document.createElement('div');
    bar.style.cssText = `
      width: 100%; max-width: 300px;
      height: 8px; background: rgba(255,255,255,0.1);
      border-radius: 4px; margin: 24px auto; overflow: hidden;
    `;
    const fill = document.createElement('div');
    fill.style.cssText = 'height:100%; width:0%; background:#cc88ff; border-radius:4px; transition:width 1.2s ease;';
    bar.appendChild(fill);
    wrap.appendChild(bar);

    const status = document.createElement('div');
    status.style.cssText = 'font-size:12px; color:#cc88ff88; text-align:center; min-height:20px;';
    status.textContent = 'جاري رصد تركيبة الأسراب...';
    wrap.appendChild(status);

    this._el.appendChild(wrap);

    setTimeout(() => { fill.style.width = '60%'; status.textContent = 'تحليل نمط الهجوم...'; }, 100);
    setTimeout(() => { fill.style.width = '100%'; status.textContent = 'اكتمل التحليل'; }, 1400);
    setTimeout(() => this._renderReveal(wrap, profile), 2200);
  }

  _renderReveal(wrap, profile) {
    wrap.innerHTML = '';

    const targetDef         = TARGET_LIST.find(t => t.id === this._selectedTarget);
    const guessedTargetDef  = TARGET_LIST.find(t => t.id === profile.guessedTargetId);
    const approachDef       = APPROACH_DIRS.find(d => d.id === this._selectedApproach);
    const guessedApproachDef = APPROACH_DIRS.find(d => d.id === profile.guessedApproach);

    const correct = (v) => v
      ? '<span style="color:#ff4444; font-weight:bold">✗ كشف</span>'
      : '<span style="color:#00ff88; font-weight:bold">✓ خطأ المدافع</span>';

    const titleEl = document.createElement('div');
    titleEl.style.cssText = 'font-size:20px; font-weight:bold; letter-spacing:3px; color:#cc88ff; margin-bottom:16px; text-align:center;';
    titleEl.textContent = 'تقرير المدافع';
    wrap.appendChild(titleEl);

    const report = document.createElement('div');
    report.style.cssText = `
      background: rgba(80,0,120,0.2);
      border: 1px solid rgba(204,136,255,0.25);
      border-radius: 12px;
      padding: 18px 20px;
      width: 100%; max-width: 400px;
      direction: rtl; text-align: right;
      font-size: 13px; line-height: 2;
    `;
    report.innerHTML = `
      <div>
        <span style="color:#aaa; font-size:11px;">الهدف الحقيقي: </span>
        <span style="color:${targetDef.color}">${targetDef.icon} ${targetDef.label}</span>
      </div>
      <div>
        <span style="color:#aaa; font-size:11px;">تخمين المدافع: </span>
        <span style="color:${guessedTargetDef.color}">${guessedTargetDef.icon} ${guessedTargetDef.label}</span>
        &nbsp;${correct(profile.targetCorrect)}
      </div>
      <hr style="border:none; border-top:1px solid rgba(255,255,255,0.08); margin:10px 0;">
      <div>
        <span style="color:#aaa; font-size:11px;">جهة الهجوم: </span>
        <span style="color:#00d4ff">${approachDef.icon} ${approachDef.label}</span>
      </div>
      <div>
        <span style="color:#aaa; font-size:11px;">تخمين المدافع: </span>
        <span style="color:#cc88ff">${guessedApproachDef.icon} ${guessedApproachDef.label}</span>
        &nbsp;${correct(profile.approachCorrect)}
      </div>
      <hr style="border:none; border-top:1px solid rgba(255,255,255,0.08); margin:10px 0;">
      <div style="color:#ffcc00; font-size:12px; text-align:center; direction:ltr;">
        ${profile.surpriseBonus > 0
          ? `⚡ مفاجأة للمدافع — مضاعف نقاط +${Math.round(profile.surpriseBonus * 100)}%`
          : '⚠ المدافع جاهز — دفاعات مشددة'}
      </div>
    `;
    wrap.appendChild(report);

    const totalDrones = Object.values(this._loadout).reduce((s, v) => s + v, 0);
    const btn = this._makeBtn(`▶  ابدأ المهمة  (${totalDrones} درون)`);
    btn.style.cssText += `
      background: rgba(80,0,120,0.88);
      border-color: #cc88ff;
      color: #ee99ff;
      font-size: 16px;
    `;
    btn.addEventListener('click', () => this._finish(profile));
    wrap.appendChild(btn);
  }

  _finish(profile) {
    this._el.style.animation = 'mssOut 0.3s ease forwards';
    setTimeout(() => {
      this._el.remove();
      this._resolve({
        targetId: this._selectedTarget,
        loadout: this._loadout,
        approach: this._selectedApproach,
        defenseProfile: profile,
      });
    }, 300);
  }

  // ── Helpers ──────────────────────────────────────────────────────────────────
  _makeWrap(title, subtitle) {
    const wrap = document.createElement('div');
    wrap.style.cssText = `
      display: flex; flex-direction: column; align-items: center;
      width: 100%; max-width: 480px; padding: 8px 4px;
    `;
    wrap.innerHTML = `
      <div style="font-size:22px; font-weight:bold; letter-spacing:2px;
                  color:#00d4ff; margin-bottom:2px; text-align:center;">${title}</div>
      ${subtitle ? `<div style="font-size:11px; color:rgba(0,212,255,0.45); margin-bottom:4px; text-align:center;">${subtitle}</div>` : ''}
    `;
    return wrap;
  }

  _makeBtn(label) {
    const btn = document.createElement('button');
    btn.className = 'mss-btn';
    btn.textContent = label;
    return btn;
  }

  _makeBackBtn() {
    const btn = document.createElement('button');
    btn.className = 'mss-back';
    btn.textContent = '‹ رجوع';
    return btn;
  }
}
