export class StartScreen {
  show() {
    return new Promise((resolve) => {
      const el = document.createElement('div');
      el.style.cssText = `
        position: fixed; inset: 0;
        display: flex; flex-direction: column;
        align-items: center; justify-content: flex-start;
        background: rgba(0,4,12,0.97);
        z-index: 300;
        font-family: monospace;
        color: #00d4ff;
        overflow-y: auto;
        -webkit-overflow-scrolling: touch;
        padding: 28px 12px 32px;
        animation: ssIn 0.5s ease;
      `;

      el.innerHTML = `
        <style>
          @keyframes ssIn  { from { opacity:0 } to { opacity:1 } }
          @keyframes ssOut { to   { opacity:0; pointer-events:none } }

          .start-btn {
            background: rgba(0,20,40,0.92);
            color: #00d4ff;
            border: 1.5px solid rgba(0,212,255,0.6);
            border-radius: 12px;
            padding: 16px 48px;
            font-size: 18px;
            cursor: pointer;
            font-family: monospace;
            letter-spacing: 2px;
            margin-top: 28px;
            min-height: 54px;
            width: 100%;
            max-width: 300px;
            transition: all 0.15s;
            -webkit-tap-highlight-color: transparent;
          }
          .start-btn:active, .start-btn:hover {
            background: rgba(0,180,255,0.2);
            border-color: #00d4ff;
            box-shadow: 0 0 24px rgba(0,212,255,0.3);
          }

          .how-row {
            display: flex;
            align-items: flex-start;
            gap: 12px;
            margin: 9px 0;
            font-size: 13px;
            color: #ccc;
            text-align: right;
            direction: rtl;
          }
          .how-icon { font-size: 20px; min-width: 28px; flex-shrink: 0; }
          .how-text { line-height: 1.6; }

          .role-row {
            display: flex;
            gap: 8px;
            flex-wrap: wrap;
            justify-content: center;
            margin: 6px 0;
          }
          .role-chip {
            background: rgba(0,212,255,0.08);
            border: 1px solid rgba(0,212,255,0.22);
            border-radius: 6px;
            padding: 5px 12px;
            font-size: 11px;
            color: #00d4ff;
          }

          /* City resources preview */
          .res-preview {
            display: flex;
            gap: 8px;
            margin: 10px 0 4px;
            justify-content: center;
            flex-wrap: wrap;
          }
          .res-chip {
            background: rgba(255,255,255,0.06);
            border: 1px solid rgba(255,255,255,0.12);
            border-radius: 8px;
            padding: 8px 14px;
            font-size: 12px;
            text-align: center;
            min-width: 80px;
          }
        </style>

        <div style="font-size:clamp(26px,7vw,38px); font-weight:bold; letter-spacing:5px;
                    text-shadow: 0 0 30px rgba(0,212,255,0.8); margin-bottom:4px; text-align:center;">
          SWARM COMMAND
        </div>
        <div style="font-size:11px; color:rgba(0,212,255,0.6); letter-spacing:3px; margin-bottom:24px; text-align:center;">
          TACTICAL DRONE SIMULATOR
        </div>

        <!-- Main info card -->
        <div style="
          background: rgba(0,20,40,0.75);
          border: 1px solid rgba(0,212,255,0.15);
          border-radius: 14px;
          padding: 20px 18px;
          width: 100%;
          max-width: 460px;
        ">
          <div style="font-size:11px; color:rgba(0,212,255,0.7); letter-spacing:2px; margin-bottom:14px; text-align:center;">
            HOW TO PLAY
          </div>

          <div class="how-row">
            <span class="how-icon">👆</span>
            <span class="how-text"><b style="color:#00d4ff">انقر أو اسحب على الشاشة</b> لتحريك سربك — يقاتل الأعداء تلقائياً في الطريق</span>
          </div>
          <div class="how-row">
            <span class="how-icon">🏙</span>
            <span class="how-text"><b style="color:#00d4ff">٣ موارد للمدينة</b> يجب حمايتها — الكهرباء ⚡ والمياه 💧 والغذاء 🌾</span>
          </div>
          <div class="how-row">
            <span class="how-icon">🔴</span>
            <span class="how-text"><b style="color:#ff4444">الأعداء</b> يهجمون الموارد — أوقفهم قبل الوصول</span>
          </div>
          <div class="how-row">
            <span class="how-icon">⚠</span>
            <span class="how-text">نضوب مورد يُضعف الآخرين — <b style="color:#ffcc00">التأثيرات المتتالية!</b></span>
          </div>

          <!-- Resource chips -->
          <div style="border-top:1px solid rgba(0,212,255,0.1); margin:14px 0 10px;"></div>
          <div style="font-size:11px; color:rgba(0,212,255,0.6); letter-spacing:2px; margin-bottom:8px; text-align:center;">
            الموارد
          </div>
          <div class="res-preview">
            <div class="res-chip" style="color:#ffcc00; border-color:rgba(255,200,0,0.25);">⚡ الكهرباء<br><span style="font-size:9px;color:#888;">المورد الأول</span></div>
            <div class="res-chip" style="color:#00aaff; border-color:rgba(0,170,255,0.25);">💧 المياه<br><span style="font-size:9px;color:#888;">تعزز الدفاع</span></div>
            <div class="res-chip" style="color:#88ff44; border-color:rgba(136,255,68,0.25);">🌾 الغذاء<br><span style="font-size:9px;color:#888;">سرعة الأسراب</span></div>
          </div>

          <div style="border-top:1px solid rgba(0,212,255,0.1); margin:14px 0 10px;"></div>
          <div style="font-size:11px; color:rgba(0,212,255,0.6); letter-spacing:2px; margin-bottom:8px; text-align:center;">
            التشكيلات
          </div>
          <div class="role-row">
            <span class="role-chip">▲ هجوم</span>
            <span class="role-chip">● دفاع 360°</span>
            <span class="role-chip">✦ تفرق</span>
            <span class="role-chip">━ خط</span>
            <span class="role-chip">⬡ حماية</span>
          </div>
        </div>

        <button class="start-btn" id="start-btn">▶  ابدأ اللعب</button>

        <div style="font-size:10px; color:rgba(0,212,255,0.25); margin-top:14px; letter-spacing:1px;">
          WAVE 1 →  ∞
        </div>
      `;

      document.body.appendChild(el);

      el.querySelector('#start-btn').addEventListener('click', () => {
        el.style.animation = 'ssOut 0.3s ease forwards';
        setTimeout(() => { el.remove(); resolve(); }, 300);
      });
    });
  }
}
