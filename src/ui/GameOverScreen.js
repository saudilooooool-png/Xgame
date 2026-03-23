export class GameOverScreen {
  constructor(onRestart) {
    this._el = null;
    this._onRestart = onRestart;
  }

  show(score, wave, samples) {
    if (this._el) return;
    const el = document.createElement('div');
    el.style.cssText = `
      position:fixed; inset:0; display:flex; flex-direction:column;
      align-items:center; justify-content:center;
      background:rgba(0,0,0,0.75); z-index:200;
      font-family:monospace; color:#00d4ff;
      animation: fadeIn 0.4s ease;
    `;
    el.innerHTML = `
      <style>
        @keyframes fadeIn { from { opacity:0; transform:scale(0.9) } to { opacity:1; transform:scale(1) } }
        .go-btn {
          background:rgba(0,20,40,0.9); color:#00d4ff;
          border:1px solid #00d4ff88; border-radius:6px;
          padding:12px 32px; font-size:15px; cursor:pointer;
          font-family:monospace; letter-spacing:1px; margin:6px;
          transition: all 0.15s;
        }
        .go-btn:hover { background:rgba(0,180,255,0.2); border-color:#00d4ff; }
      </style>
      <div style="font-size:42px; font-weight:bold; letter-spacing:4px;
                  text-shadow:0 0 30px #00d4ff; margin-bottom:32px;">
        OBJECTIVE LOST
      </div>
      <div style="font-size:16px; color:#aaa; margin-bottom:8px;">
        WAVE REACHED &nbsp;<span style="color:#00d4ff">${wave}</span>
      </div>
      <div style="font-size:16px; color:#aaa; margin-bottom:8px;">
        FINAL SCORE &nbsp;<span style="color:#00d4ff">${score}</span>
      </div>
      <div style="font-size:14px; color:#00ff88; margin-bottom:36px;">
        ⬡ ${samples} training samples collected
      </div>
      <div style="display:flex; gap:12px;">
        <button class="go-btn" id="go-restart">↺  RETRY</button>
        <button class="go-btn" id="go-export" style="color:#00ff88; border-color:#00ff8844;">
          ⬇ EXPORT DATA
        </button>
      </div>
    `;
    document.body.appendChild(el);
    this._el = el;

    document.getElementById('go-restart').addEventListener('click', () => {
      this._remove();
      this._onRestart();
    });
    document.getElementById('go-export').addEventListener('click', () => {
      this._onExport?.();
    });
  }

  onExport(fn) { this._onExport = fn; }

  _remove() {
    this._el?.remove();
    this._el = null;
  }
}
