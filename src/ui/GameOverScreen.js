import { checkAchievements } from '../data/StoryLines.js';

/**
 * GameOverScreen — shown when the city falls.
 *
 * Displays:
 *   - Dramatic title (varies by performance)
 *   - Story recap
 *   - Final stats (wave, score, kills, losses)
 *   - City resources final state
 *   - Achievements earned this run
 *   - Retry / Export buttons
 */
export class GameOverScreen {
  constructor(onRestart) {
    this._el        = null;
    this._onRestart = onRestart;
    this._onExport  = null;
  }

  /**
   * @param {number} score
   * @param {number} wave
   * @param {number} samples
   * @param {object} gameStats — { objectivesAlive, maxStreak, bossWavesCleared,
   *                               totalKills, totalLosses, resources:{power,water,food} }
   */
  show(score, wave, samples, gameStats = {}) {
    if (this._el) return;

    const stats = {
      wave,
      score,
      objectivesAlive: gameStats.objectivesAlive ?? 0,
      maxStreak:        gameStats.maxStreak        ?? 0,
      bossWavesCleared: gameStats.bossWavesCleared ?? 0,
      totalKills:       gameStats.totalKills       ?? 0,
      totalLosses:      gameStats.totalLosses      ?? 0,
      resources:        gameStats.resources        ?? { power: 0, water: 0, food: 0 },
    };

    const achievements = checkAchievements(stats);
    const { title, sub, titleColor } = this._getDramaticTitle(stats);

    const el = document.createElement('div');
    el.style.cssText = `
      position: fixed; inset: 0;
      display: flex; flex-direction: column;
      align-items: center; justify-content: flex-start;
      background: rgba(0,0,0,0.88);
      z-index: 200;
      font-family: monospace;
      color: #00d4ff;
      overflow-y: auto;
      -webkit-overflow-scrolling: touch;
      padding: 32px 12px 40px;
      animation: goIn 0.5s ease;
    `;

    el.innerHTML = `
      <style>
        @keyframes goIn { from { opacity:0; transform:scale(0.92) } to { opacity:1; transform:none } }
        .go-btn {
          background: rgba(0,20,40,0.9);
          color: #00d4ff;
          border: 1.5px solid rgba(0,212,255,0.55);
          border-radius: 10px;
          padding: 13px 28px;
          font-size: 15px;
          cursor: pointer;
          font-family: monospace;
          letter-spacing: 1px;
          min-height: 50px;
          transition: all 0.15s;
          -webkit-tap-highlight-color: transparent;
          flex: 1;
          max-width: 180px;
        }
        .go-btn:active, .go-btn:hover { background: rgba(0,180,255,0.2); border-color: #00d4ff; }
        .ach-chip {
          display: inline-flex; align-items: center; gap: 6px;
          background: rgba(255,200,0,0.1);
          border: 1px solid rgba(255,200,0,0.3);
          border-radius: 20px;
          padding: 6px 14px;
          font-size: 12px;
          color: #ffcc00;
          margin: 4px;
        }
        .res-bar-wrap { display:flex; align-items:center; gap:8px; margin:5px 0; }
        .res-bar-bg { flex:1; height:8px; background:rgba(255,255,255,0.08); border-radius:4px; overflow:hidden; }
        .res-bar-fill { height:100%; border-radius:4px; }
      </style>

      <!-- Dramatic title -->
      <div style="font-size:clamp(22px,5vw,36px); font-weight:bold; letter-spacing:3px;
                  color:${titleColor}; text-shadow:0 0 30px ${titleColor}; margin-bottom:6px; text-align:center;">
        ${title}
      </div>
      <div style="font-size:13px; color:rgba(255,255,255,0.5); margin-bottom:24px; text-align:center; max-width:380px;">
        ${sub}
      </div>

      <!-- Stats panel -->
      <div id="go-stats-panel" style="
        background: rgba(0,15,35,0.85);
        border: 1px solid rgba(0,212,255,0.18);
        border-radius: 14px;
        padding: 18px 20px;
        width: 100%; max-width: 440px;
        margin-bottom: 16px;
      ">
        <!-- Wave + Score row -->
        <div style="display:flex; justify-content:space-around; margin-bottom:14px; text-align:center;">
          <div>
            <div style="font-size:28px; font-weight:bold; color:#00d4ff;">${wave}</div>
            <div style="font-size:10px; color:rgba(0,212,255,0.55); letter-spacing:1px;">WAVE</div>
          </div>
          <div style="width:1px; background:rgba(255,255,255,0.08);"></div>
          <div>
            <div style="font-size:28px; font-weight:bold; color:#ffcc00;">${score.toLocaleString()}</div>
            <div style="font-size:10px; color:rgba(255,200,0,0.55); letter-spacing:1px;">SCORE</div>
          </div>
          <div style="width:1px; background:rgba(255,255,255,0.08);"></div>
          <div>
            <div style="font-size:28px; font-weight:bold; color:#00ff88;">${stats.totalKills}</div>
            <div style="font-size:10px; color:rgba(0,255,136,0.55); letter-spacing:1px;">KILLS</div>
          </div>
          <div style="width:1px; background:rgba(255,255,255,0.08);"></div>
          <div>
            <div style="font-size:28px; font-weight:bold; color:#ff6655;">${stats.totalLosses}</div>
            <div style="font-size:10px; color:rgba(255,100,80,0.55); letter-spacing:1px;">LOSSES</div>
          </div>
        </div>

        <!-- Streak + Boss -->
        <div style="display:flex; gap:10px; justify-content:center; margin-bottom:14px; flex-wrap:wrap;">
          ${stats.maxStreak >= 2 ? `
            <div style="font-size:12px; color:#ffcc00; background:rgba(255,200,0,0.1);
                        border:1px solid rgba(255,200,0,0.3); border-radius:6px; padding:4px 12px;">
              🔥 أفضل سلسلة ×${stats.maxStreak}
            </div>` : ''}
          ${stats.bossWavesCleared > 0 ? `
            <div style="font-size:12px; color:#ff8888; background:rgba(255,100,0,0.1);
                        border:1px solid rgba(255,100,0,0.3); border-radius:6px; padding:4px 12px;">
              💀 ${stats.bossWavesCleared} موجة قائد
            </div>` : ''}
          <div style="font-size:12px; color:#00ff88; background:rgba(0,255,136,0.08);
                      border:1px solid rgba(0,255,136,0.2); border-radius:6px; padding:4px 12px;">
            ⬡ ${samples} بيانات
          </div>
        </div>

        <!-- Resources final state -->
        <div style="border-top:1px solid rgba(255,255,255,0.07); padding-top:12px;">
          <div style="font-size:10px; color:rgba(255,255,255,0.35); letter-spacing:1px; margin-bottom:8px; text-align:center;">
            الحالة الأخيرة للموارد
          </div>
          ${this._resourceBar('⚡', 'الكهرباء', stats.resources.power,  '#ffcc00')}
          ${this._resourceBar('💧', 'المياه',   stats.resources.water,  '#00aaff')}
          ${this._resourceBar('🌾', 'الغذاء',   stats.resources.food,   '#88ff44')}
        </div>
      </div>

      <!-- Achievements -->
      ${achievements.length ? `
        <div style="width:100%; max-width:440px; margin-bottom:16px;">
          <div style="font-size:11px; color:rgba(255,200,0,0.6); letter-spacing:2px; text-align:center; margin-bottom:8px;">
            ACHIEVEMENTS UNLOCKED
          </div>
          <div style="display:flex; flex-wrap:wrap; justify-content:center;">
            ${achievements.map(a => `
              <span class="ach-chip">${a.icon} ${a.label}</span>
            `).join('')}
          </div>
        </div>
      ` : ''}

      <!-- Buttons -->
      <div style="display:flex; gap:12px; width:100%; max-width:380px;">
        <button class="go-btn" id="go-restart">↺ حاول مجدداً</button>
        <button class="go-btn" id="go-export"
          style="color:#00ff88; border-color:rgba(0,255,136,0.4);">
          ⬇ تصدير البيانات
        </button>
      </div>
    `;

    document.body.appendChild(el);
    this._el = el;

    el.querySelector('#go-restart').addEventListener('click', () => {
      this._remove();
      this._onRestart();
    });
    el.querySelector('#go-export').addEventListener('click', () => {
      this._onExport?.();
    });
  }

  onExport(fn) { this._onExport = fn; }

  _remove() {
    this._el?.remove();
    this._el = null;
  }

  /** Returns inline HTML for one resource bar row */
  _resourceBar(icon, label, value, color) {
    const pct = Math.max(0, Math.min(100, value ?? 0));
    const barColor = pct > 60 ? color : pct > 30 ? '#ffaa00' : '#ff3344';
    const statusText = pct <= 0 ? 'مدمر' : pct <= 30 ? 'خطر' : pct <= 60 ? 'ضعيف' : 'بخير';
    return `
      <div class="res-bar-wrap">
        <span style="font-size:14px; min-width:20px;">${icon}</span>
        <span style="font-size:10px; color:rgba(255,255,255,0.5); min-width:56px; direction:rtl;">${label}</span>
        <div class="res-bar-bg">
          <div class="res-bar-fill" style="width:${pct}%; background:${barColor};"></div>
        </div>
        <span style="font-size:10px; color:${barColor}; min-width:42px; text-align:right;">${Math.ceil(pct)}% ${statusText}</span>
      </div>
    `;
  }

  /** Choose dramatic title based on game outcome */
  _getDramaticTitle(stats) {
    if (stats.wave >= 20) {
      return { title: 'أسطورة الدفاع', sub: 'لم يتوقع أحد أن تصمد حتى الموجة العشرين', titleColor: '#ffcc00' };
    }
    if (stats.wave >= 15) {
      return { title: 'مدافع أسطوري', sub: 'المدينة قاومت لفترة طويلة بفضل قيادتك', titleColor: '#cc88ff' };
    }
    if (stats.wave >= 10) {
      return { title: 'الصمود العظيم', sub: 'عشر موجات من الدماء والحديد — المدينة فخورة بك', titleColor: '#00d4ff' };
    }
    if (stats.objectivesAlive >= 2) {
      return { title: 'سقطت المدينة', sub: 'كانت قريباً من النجاة — حاول مجدداً', titleColor: '#ff6644' };
    }
    if (stats.objectivesAlive === 1) {
      return { title: 'الصمود الأخير', sub: 'مورد واحد بقي حتى النهاية — كان قريباً جداً', titleColor: '#ff8844' };
    }
    return { title: 'المدينة سقطت', sub: 'جميع الموارد استُنزفت — الحصار انتهى', titleColor: '#ff4444' };
  }
}
