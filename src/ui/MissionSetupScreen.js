import { TARGET_LIST } from '../entities/TargetTypes.js';
import { buildDefenseProfile } from '../ai/DefenderAI.js';

const DRONE_DEFS = [
  { role: 'standard',    icon: '◈', label: 'Standard',    cost: 1, color: '#00d4ff', desc: 'متوازن — الوحدة الأساسية\n100 HP | 130 سرعة | 40 ضرر' },
  { role: 'interceptor', icon: '▲', label: 'Interceptor', cost: 2, color: '#44ffcc', desc: 'سريع وخفيف — يصطاد الرشاشين\n75 HP  | 170 سرعة | 28 ضرر' },
  { role: 'gunship',     icon: '◆', label: 'Gunship',     cost: 3, color: '#ffaa00', desc: 'قوة نارية عالية — يضرب الأهداف الثقيلة\n130 HP | 88 سرعة  | 58 ضرر' },
  { role: 'sentinel',    icon: '⬡', label: 'Sentinel',    cost: 2, color: '#88ff44', desc: 'دفاع طويل المدى — خط المواجهة\n165 HP | 58 سرعة  | 24 ضرر' },
];

const APPROACH_DIRS = [
  { id: 'top',    label: 'شمال ↑', icon: '↑' },
  { id: 'right',  label: 'شرق →',  icon: '→' },
  { id: 'bottom', label: 'جنوب ↓', icon: '↓' },
  { id: 'left',   label: 'غرب ←',  icon: '←' },
];

const BUDGET = 20; // total points

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
        position:fixed; inset:0; display:flex; flex-direction:column;
        align-items:center; justify-content:center;
        background:rgba(0,4,12,0.97); z-index:300;
        font-family:monospace; color:#00d4ff;
        animation: fadeIn 0.4s ease;
      `;
      const style = document.createElement('style');
      style.textContent = `
        @keyframes fadeIn { from{opacity:0} to{opacity:1} }
        @keyframes fadeOut { to{opacity:0;pointer-events:none} }
        .mss-card {
          background:rgba(0,20,40,0.8); border:1px solid #00d4ff22;
          border-radius:10px; padding:16px 20px; cursor:pointer;
          transition:all 0.15s; min-width:130px; text-align:center;
        }
        .mss-card:hover { border-color:#00d4ff88; background:rgba(0,60,100,0.5); }
        .mss-card.selected { border-color:#00d4ff; background:rgba(0,120,200,0.25);
          box-shadow:0 0 18px #00d4ff33; }
        .mss-btn {
          background:rgba(0,20,40,0.9); color:#00d4ff;
          border:1px solid #00d4ff66; border-radius:6px;
          padding:11px 36px; font-size:15px; cursor:pointer;
          font-family:monospace; letter-spacing:1px;
          transition:all 0.15s; margin-top:24px;
        }
        .mss-btn:hover { background:rgba(0,180,255,0.2); border-color:#00d4ff; }
        .mss-btn:disabled { opacity:0.35; cursor:not-allowed; }
        .mss-counter { display:flex; align-items:center; gap:8px; margin-top:8px; justify-content:center; }
        .mss-cb {
          background:rgba(0,20,40,0.9); color:#00d4ff; border:1px solid #00d4ff44;
          border-radius:4px; width:26px; height:26px; font-size:16px; cursor:pointer;
          font-family:monospace; transition:all 0.1s; display:flex; align-items:center; justify-content:center;
        }
        .mss-cb:hover { background:rgba(0,180,255,0.2); }
        .mss-cb:disabled { opacity:0.25; cursor:not-allowed; }
      `;
      document.head.appendChild(style);
      document.body.appendChild(this._el);
      this._renderStep();
    });
  }

  _renderStep() {
    this._el.innerHTML = '';
    if (this._step === 1) this._renderTargetStep();
    else if (this._step === 2) this._renderLoadoutStep();
    else if (this._step === 3) this._renderApproachStep();
    else this._renderAnalysisStep();
  }

  // ── Step 1: Target ─────────────────────────────────────────────────────────
  _renderTargetStep() {
    const wrap = this._makeWrap('الخطوة 1 / 3 — اختر الهدف', '');

    const grid = document.createElement('div');
    grid.style.cssText = 'display:flex; gap:14px; flex-wrap:wrap; justify-content:center; margin-top:20px;';

    for (const t of TARGET_LIST) {
      const card = document.createElement('div');
      card.className = 'mss-card';
      card.innerHTML = `
        <div style="font-size:32px; margin-bottom:8px;">${t.icon}</div>
        <div style="font-size:14px; color:${t.color}; font-weight:bold;">${t.label}</div>
        <div style="font-size:11px; color:#aaa; margin-top:6px;">${t.desc}</div>
        <div style="font-size:11px; color:#ffcc00; margin-top:6px;">×${t.scoreMulti} نقاط</div>
      `;
      if (this._selectedTarget === t.id) card.classList.add('selected');
      card.addEventListener('click', () => {
        this._selectedTarget = t.id;
        this._renderStep();
      });
      grid.appendChild(card);
    }

    wrap.appendChild(grid);

    const btn = this._makeNextBtn('التالي: بناء السرب →');
    btn.disabled = !this._selectedTarget;
    btn.addEventListener('click', () => { this._step = 2; this._renderStep(); });
    wrap.appendChild(btn);
    this._el.appendChild(wrap);
  }

  // ── Step 2: Loadout ────────────────────────────────────────────────────────
  _renderLoadoutStep() {
    const wrap = this._makeWrap(
      'الخطوة 2 / 3 — جهّز أسرابك',
      `الميزانية: <span id="mss-rem" style="color:#ffcc00">${this._remaining}</span> / ${BUDGET} نقطة`
    );

    const grid = document.createElement('div');
    grid.style.cssText = 'display:flex; gap:14px; flex-wrap:wrap; justify-content:center; margin-top:20px;';

    for (const def of DRONE_DEFS) {
      const card = document.createElement('div');
      card.className = 'mss-card';
      card.style.minWidth = '140px';
      const count = this._loadout[def.role];
      card.innerHTML = `
        <div style="font-size:26px; color:${def.color}; margin-bottom:6px;">${def.icon}</div>
        <div style="font-size:13px; color:${def.color}; font-weight:bold;">${def.label}</div>
        <div style="font-size:10px; color:#888; margin-top:4px; white-space:pre-line; line-height:1.5">${def.desc}</div>
        <div style="font-size:11px; color:#ffcc00; margin-top:6px;">تكلفة: ${def.cost} نقطة/درون</div>
        <div class="mss-counter">
          <button class="mss-cb" id="dec-${def.role}" ${count === 0 ? 'disabled' : ''}>−</button>
          <span style="font-size:16px; min-width:22px; text-align:center; color:#fff" id="cnt-${def.role}">${count}</span>
          <button class="mss-cb" id="inc-${def.role}" ${this._remaining < def.cost ? 'disabled' : ''}>+</button>
        </div>
      `;
      grid.appendChild(card);
    }

    wrap.appendChild(grid);

    const totalDrones = Object.values(this._loadout).reduce((s, v) => s + v, 0);
    const summary = document.createElement('div');
    summary.id = 'mss-summary';
    summary.style.cssText = 'font-size:12px; color:#00d4ff88; margin-top:14px; text-align:center;';
    summary.textContent = totalDrones > 0
      ? `إجمالي الدرونز: ${totalDrones}`
      : 'اختر درونز للمتابعة';
    wrap.appendChild(summary);

    const btn = this._makeNextBtn('التالي: جهة الهجوم →');
    btn.disabled = totalDrones === 0;
    btn.addEventListener('click', () => { this._step = 3; this._renderStep(); });
    wrap.appendChild(btn);

    // Back button
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

  // ── Step 3: Approach direction ─────────────────────────────────────────────
  _renderApproachStep() {
    const wrap = this._makeWrap(
      'الخطوة 3 / 3 — اختر جهة الهجوم',
      'سرية تامة — المدافع لا يعرف من أين ستهجم'
    );

    const grid = document.createElement('div');
    grid.style.cssText = 'display:flex; gap:14px; flex-wrap:wrap; justify-content:center; margin-top:24px;';

    for (const dir of APPROACH_DIRS) {
      const card = document.createElement('div');
      card.className = 'mss-card';
      card.style.minWidth = '100px';
      card.innerHTML = `
        <div style="font-size:30px; margin-bottom:8px;">${dir.icon}</div>
        <div style="font-size:13px; color:#00d4ff;">${dir.label}</div>
      `;
      if (this._selectedApproach === dir.id) card.classList.add('selected');
      card.addEventListener('click', () => {
        this._selectedApproach = dir.id;
        this._renderStep();
      });
      grid.appendChild(card);
    }

    wrap.appendChild(grid);

    const btn = this._makeNextBtn('ابدأ التحليل ►');
    btn.disabled = !this._selectedApproach;
    btn.addEventListener('click', () => { this._step = 4; this._renderStep(); });
    wrap.appendChild(btn);

    const back = this._makeBackBtn();
    back.addEventListener('click', () => { this._step = 2; this._renderStep(); });
    wrap.appendChild(back);

    this._el.appendChild(wrap);
  }

  // ── Step 4: Defender analysis animation → reveal ───────────────────────────
  _renderAnalysisStep() {
    const profile = buildDefenseProfile(this._loadout, this._selectedTarget, this._selectedApproach);

    const wrap = this._makeWrap('تحليل المدافع...', '');
    wrap.style.maxWidth = '500px';

    // Simulated analysis progress
    const bar = document.createElement('div');
    bar.style.cssText = `
      width:320px; height:8px; background:rgba(255,255,255,0.1);
      border-radius:4px; margin:24px auto; overflow:hidden;
    `;
    const fill = document.createElement('div');
    fill.style.cssText = `height:100%; width:0%; background:#cc88ff;
      border-radius:4px; transition:width 1.2s ease;`;
    bar.appendChild(fill);
    wrap.appendChild(bar);

    const status = document.createElement('div');
    status.style.cssText = 'font-size:12px; color:#cc88ff88; text-align:center; min-height:20px;';
    status.textContent = 'جاري رصد تركيبة الأسراب...';
    wrap.appendChild(status);

    this._el.appendChild(wrap);

    // Animate then reveal
    setTimeout(() => { fill.style.width = '60%'; status.textContent = 'تحليل نمط الهجوم...'; }, 100);
    setTimeout(() => { fill.style.width = '100%'; status.textContent = 'اكتمل التحليل'; }, 1400);
    setTimeout(() => this._renderReveal(wrap, profile), 2200);
  }

  _renderReveal(wrap, profile) {
    wrap.innerHTML = '';

    const targetDef = TARGET_LIST.find(t => t.id === this._selectedTarget);
    const guessedTargetDef = TARGET_LIST.find(t => t.id === profile.guessedTargetId);
    const approachDef = APPROACH_DIRS.find(d => d.id === this._selectedApproach);
    const guessedApproachDef = APPROACH_DIRS.find(d => d.id === profile.guessedApproach);

    const correct = (v) => v
      ? '<span style="color:#ff4444">✗ كشف</span>'
      : '<span style="color:#00ff88">✓ خطأ المدافع</span>';

    wrap.innerHTML = `
      <div style="font-size:22px; font-weight:bold; letter-spacing:3px; color:#cc88ff; margin-bottom:20px;">
        تقرير المدافع
      </div>
      <div style="background:rgba(80,0,120,0.25); border:1px solid #cc88ff33;
                  border-radius:10px; padding:20px 28px; width:380px; text-align:right; direction:rtl;">
        <div style="margin-bottom:14px;">
          <span style="color:#aaa; font-size:12px;">الهدف الحقيقي:</span>
          <span style="color:${targetDef.color}; font-size:14px; margin-right:8px;">
            ${targetDef.icon} ${targetDef.label}
          </span>
        </div>
        <div style="margin-bottom:14px;">
          <span style="color:#aaa; font-size:12px;">تخمين المدافع:</span>
          <span style="color:${guessedTargetDef.color}; font-size:14px; margin-right:8px;">
            ${guessedTargetDef.icon} ${guessedTargetDef.label}
          </span>
          &nbsp;${correct(profile.targetCorrect)}
        </div>
        <hr style="border:none; border-top:1px solid #ffffff11; margin:12px 0;">
        <div style="margin-bottom:14px;">
          <span style="color:#aaa; font-size:12px;">جهة الهجوم:</span>
          <span style="color:#00d4ff; font-size:14px; margin-right:8px;">
            ${approachDef.icon} ${approachDef.label}
          </span>
        </div>
        <div style="margin-bottom:14px;">
          <span style="color:#aaa; font-size:12px;">تخمين المدافع:</span>
          <span style="color:#cc88ff; font-size:14px; margin-right:8px;">
            ${guessedApproachDef.icon} ${guessedApproachDef.label}
          </span>
          &nbsp;${correct(profile.approachCorrect)}
        </div>
        <hr style="border:none; border-top:1px solid #ffffff11; margin:12px 0;">
        <div style="font-size:13px; color:#ffcc00; margin-top:4px;">
          ${profile.surpriseBonus > 0
            ? `⚡ مفاجأة للمدافع — مضاعف نقاط +${Math.round(profile.surpriseBonus * 100)}%`
            : '⚠ المدافع جاهز — دفاعات مشددة'}
        </div>
      </div>
    `;

    const totalDrones = Object.values(this._loadout).reduce((s, v) => s + v, 0);
    const btn = this._makeNextBtn(`▶  ابدأ المهمة (${totalDrones} درون)`);
    btn.style.background = 'rgba(80,0,120,0.9)';
    btn.style.borderColor = '#cc88ff';
    btn.style.color = '#ee99ff';
    btn.addEventListener('click', () => this._finish(profile));
    wrap.appendChild(btn);
  }

  _finish(profile) {
    this._el.style.animation = 'fadeOut 0.3s ease forwards';
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

  // ── Helpers ─────────────────────────────────────────────────────────────────
  _makeWrap(title, subtitle) {
    const wrap = document.createElement('div');
    wrap.style.cssText = 'display:flex; flex-direction:column; align-items:center; width:90%; max-width:700px;';
    wrap.innerHTML = `
      <div style="font-size:20px; font-weight:bold; letter-spacing:3px;
                  color:#00d4ff; margin-bottom:6px; text-align:center;">${title}</div>
      <div style="font-size:12px; color:#00d4ff66; margin-bottom:4px; text-align:center;">${subtitle}</div>
    `;
    return wrap;
  }

  _makeNextBtn(label) {
    const btn = document.createElement('button');
    btn.className = 'mss-btn';
    btn.textContent = label;
    return btn;
  }

  _makeBackBtn() {
    const btn = document.createElement('button');
    btn.style.cssText = `
      background:transparent; color:#00d4ff44; border:none;
      font-family:monospace; font-size:12px; cursor:pointer;
      margin-top:8px; letter-spacing:1px;
    `;
    btn.textContent = '← رجوع';
    return btn;
  }
}
