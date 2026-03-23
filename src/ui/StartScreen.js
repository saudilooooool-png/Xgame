export class StartScreen {
  /**
   * Shows a start screen and returns a Promise that resolves when the player clicks Start.
   */
  show() {
    return new Promise((resolve) => {
      const el = document.createElement('div');
      el.style.cssText = `
        position:fixed; inset:0; display:flex; flex-direction:column;
        align-items:center; justify-content:center;
        background:rgba(0,4,12,0.96); z-index:300;
        font-family:monospace; color:#00d4ff;
        animation: fadeIn 0.5s ease;
      `;

      el.innerHTML = `
        <style>
          @keyframes fadeIn { from { opacity:0 } to { opacity:1 } }
          .start-btn {
            background:rgba(0,20,40,0.9); color:#00d4ff;
            border:1px solid #00d4ff88; border-radius:6px;
            padding:14px 48px; font-size:17px; cursor:pointer;
            font-family:monospace; letter-spacing:2px; margin-top:36px;
            transition: all 0.15s;
          }
          .start-btn:hover { background:rgba(0,180,255,0.2); border-color:#00d4ff; box-shadow:0 0 18px #00d4ff44; }
          .how-row { display:flex; align-items:flex-start; gap:14px; margin:7px 0; font-size:14px; color:#ccc; max-width:440px; }
          .how-icon { font-size:20px; min-width:28px; text-align:center; }
          .how-text { line-height:1.5; }
          .role-row { display:flex; gap:10px; flex-wrap:wrap; justify-content:center; margin:6px 0; }
          .role-chip {
            background:rgba(0,212,255,0.08); border:1px solid #00d4ff33;
            border-radius:4px; padding:4px 12px; font-size:12px; color:#00d4ff;
          }
        </style>

        <div style="font-size:36px; font-weight:bold; letter-spacing:6px;
                    text-shadow:0 0 30px #00d4ff; margin-bottom:6px;">
          SWARM COMMAND
        </div>
        <div style="font-size:13px; color:#00d4ff88; letter-spacing:3px; margin-bottom:32px;">
          TACTICAL DRONE SIMULATOR
        </div>

        <!-- How to play -->
        <div style="background:rgba(0,20,40,0.7); border:1px solid #00d4ff22;
                    border-radius:10px; padding:24px 32px; max-width:480px; width:90%;">
          <div style="font-size:13px; color:#00d4ffaa; letter-spacing:2px; margin-bottom:16px;">
            HOW TO PLAY
          </div>

          <div class="how-row">
            <span class="how-icon">🖱️</span>
            <span class="how-text"><b style="color:#00d4ff">انقر على الشاشة</b> لتحريك سربك نحو الهدف — قاتل الأعداء في الطريق</span>
          </div>
          <div class="how-row">
            <span class="how-icon">🔵</span>
            <span class="how-text"><b style="color:#00d4ff">الهدف (الدائرة الزرقاء)</b> يجب حمايته — إذا وصل إليه الأعداء تخسر صحة</span>
          </div>
          <div class="how-row">
            <span class="how-icon">🔴</span>
            <span class="how-text"><b style="color:#ff4444">الأعداء (أحمر)</b> يهجمون الهدف — أوقفهم قبل ما يصلوا</span>
          </div>
          <div class="how-row">
            <span class="how-icon">⬡</span>
            <span class="how-text"><b style="color:#00d4ff">التشكيلات</b> في الأسفل — غيّر التكتيك حسب الموقف</span>
          </div>

          <div style="border-top:1px solid #00d4ff22; margin:16px 0 12px;"></div>

          <div style="font-size:12px; color:#00d4ff88; letter-spacing:2px; margin-bottom:10px;">التشكيلات</div>
          <div class="role-row">
            <span class="role-chip">▲ Wedge — هجوم مركّز</span>
            <span class="role-chip">● Circle — دفاع 360°</span>
            <span class="role-chip">✦ Scatter — تفادي</span>
            <span class="role-chip">━ Line — جدار دفاعي</span>
            <span class="role-chip">⬡ Defend — حماية الهدف</span>
          </div>
        </div>

        <button class="start-btn" id="start-btn">▶  ابدأ اللعب</button>
        <div style="font-size:11px; color:#00d4ff33; margin-top:16px; letter-spacing:1px;">
          WAVE 1 →  ∞
        </div>
      `;

      document.body.appendChild(el);

      document.getElementById('start-btn').addEventListener('click', () => {
        el.style.animation = 'fadeOut 0.3s ease forwards';
        el.style.cssText += 'animation: fadeOut 0.3s ease forwards;';
        // Add fadeOut keyframe dynamically
        const style = document.createElement('style');
        style.textContent = '@keyframes fadeOut { to { opacity:0; pointer-events:none } }';
        document.head.appendChild(style);
        setTimeout(() => { el.remove(); resolve(); }, 300);
      });
    });
  }
}
