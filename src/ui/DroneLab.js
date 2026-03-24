import { TEAM_COLORS, RADAR_SHAPES, defaultIdentity } from '../data/PlayerIdentity.js';

/**
 * DroneLab — pre-game drone customization screen.
 *
 * Player configures:
 *   • Callsign (text input, max 8 chars)
 *   • Team color (6 swatches → all drones + radar blips use this color)
 *   • Radar signature (4 shapes → friendly blip shape on radar)
 *   • Blueprint: 3 tradeoff sliders
 *       Speed ◄──●──► Armor
 *       Damage◄──●──► Fire Rate
 *       Range ◄──●──► Aggression
 *
 * Returns a Promise that resolves with the identity object.
 */
export class DroneLab {
  constructor(previousIdentity = null) {
    this._prev = previousIdentity;
  }

  show() {
    return new Promise((resolve) => {
      const id = this._prev ?? defaultIdentity();
      const el = document.createElement('div');
      el.style.cssText = `
        position: fixed; inset: 0;
        background: rgba(0,8,4,0.97);
        display: flex; align-items: center; justify-content: center;
        z-index: 300; font-family: monospace;
        animation: dlFadeIn 0.35s ease;
        overflow-y: auto; padding: 20px 12px;
      `;

      el.innerHTML = `
        <style>
          @keyframes dlFadeIn { from { opacity:0; transform:scale(0.94) } to { opacity:1; transform:none } }
          .dl-card {
            background: rgba(0,18,10,0.98);
            border: 1.5px solid rgba(0,200,80,0.22);
            border-radius: 16px;
            padding: 28px 26px;
            width: 100%; max-width: 440px;
            color: rgba(0,220,90,0.9);
          }
          .dl-title {
            font-size: 14px; font-weight: bold; letter-spacing: 3px;
            color: rgba(0,255,110,0.9); text-align: center;
            margin-bottom: 4px;
          }
          .dl-sub {
            font-size: 10px; color: rgba(0,200,80,0.45); text-align: center;
            margin-bottom: 24px; letter-spacing: 1px;
          }
          .dl-section { margin-bottom: 20px; }
          .dl-label {
            font-size: 9px; letter-spacing: 2px; color: rgba(0,200,80,0.55);
            margin-bottom: 8px;
          }
          .dl-input {
            background: rgba(0,255,100,0.06);
            border: 1px solid rgba(0,200,80,0.30);
            border-radius: 6px; padding: 8px 12px;
            color: rgba(0,255,110,1); font-family: monospace;
            font-size: 15px; letter-spacing: 2px; font-weight: bold;
            width: 100%; box-sizing: border-box; outline: none;
          }
          .dl-input:focus { border-color: rgba(0,255,100,0.6); }
          .dl-swatches { display: flex; gap: 8px; flex-wrap: wrap; }
          .dl-swatch {
            width: 36px; height: 36px; border-radius: 8px;
            cursor: pointer; border: 2px solid transparent;
            transition: transform 0.1s, border-color 0.1s;
            display: flex; align-items: center; justify-content: center;
            font-size: 11px;
            -webkit-tap-highlight-color: transparent;
          }
          .dl-swatch:hover { transform: scale(1.1); }
          .dl-swatch.active { border-color: white; transform: scale(1.1); }
          .dl-shapes { display: flex; gap: 10px; }
          .dl-shape {
            flex: 1; padding: 10px 4px; border-radius: 8px; cursor: pointer;
            border: 1.5px solid rgba(0,200,80,0.20);
            text-align: center; font-size: 18px;
            transition: all 0.1s;
            -webkit-tap-highlight-color: transparent;
          }
          .dl-shape .dl-shape-hint {
            font-size: 9px; color: rgba(0,200,80,0.45); display: block; margin-top: 3px;
          }
          .dl-shape:hover { border-color: rgba(0,255,100,0.5); }
          .dl-shape.active {
            border-color: rgba(0,255,100,0.85);
            background: rgba(0,255,100,0.08);
            color: rgba(0,255,110,1);
          }
          .dl-slider-row {
            display: flex; align-items: center; gap: 10px;
            margin-bottom: 14px;
          }
          .dl-slider-side {
            font-size: 9px; letter-spacing: 1px; min-width: 64px;
            color: rgba(0,200,80,0.65);
          }
          .dl-slider-side.right { text-align: right; }
          .dl-range {
            flex: 1; -webkit-appearance: none; appearance: none;
            height: 4px; border-radius: 2px;
            background: linear-gradient(to right, rgba(0,255,100,0.6), rgba(0,255,100,0.1));
            outline: none; cursor: pointer;
          }
          .dl-range::-webkit-slider-thumb {
            -webkit-appearance: none; width: 14px; height: 14px;
            border-radius: 50%; background: #00ff88;
            box-shadow: 0 0 8px #00ff88; cursor: pointer;
          }
          .dl-range::-moz-range-thumb {
            width: 14px; height: 14px; border-radius: 50%;
            background: #00ff88; box-shadow: 0 0 8px #00ff88;
            border: none; cursor: pointer;
          }
          .dl-preview {
            font-size: 9px; color: rgba(0,220,90,0.55);
            text-align: center; margin-top: -10px; margin-bottom: 14px;
            min-height: 12px;
          }
          .dl-deploy {
            width: 100%; padding: 14px; margin-top: 8px;
            background: rgba(0,40,20,0.9);
            color: rgba(0,255,100,1); border: 1.5px solid rgba(0,255,100,0.5);
            border-radius: 10px; font-size: 14px; font-family: monospace;
            font-weight: bold; letter-spacing: 2px; cursor: pointer;
            transition: all 0.15s; min-height: 52px;
            -webkit-tap-highlight-color: transparent;
          }
          .dl-deploy:hover, .dl-deploy:active {
            background: rgba(0,255,100,0.15); border-color: rgba(0,255,100,0.9);
          }
        </style>

        <div class="dl-card">
          <div class="dl-title">DRONE CUSTOMIZATION LAB</div>
          <div class="dl-sub">CONFIGURE YOUR SWARM BEFORE DEPLOYMENT</div>

          <!-- Callsign -->
          <div class="dl-section">
            <div class="dl-label">CALLSIGN</div>
            <input class="dl-input" id="dl-callsign"
                   maxlength="8" value="${id.callsign.toUpperCase()}"
                   placeholder="ALPHA" autocomplete="off" spellcheck="false"/>
          </div>

          <!-- Team color -->
          <div class="dl-section">
            <div class="dl-label">TEAM COLOR — RADAR GLOW</div>
            <div class="dl-swatches" id="dl-colors">
              ${TEAM_COLORS.map((c, i) => `
                <div class="dl-swatch ${c.color === id.teamColor ? 'active' : ''}"
                     data-idx="${i}"
                     style="background:${c.color}22; border-color:${c.color}55;"
                     title="${c.name}">
                  <span style="color:${c.color}; font-size:18px;">●</span>
                </div>
              `).join('')}
            </div>
          </div>

          <!-- Radar shape -->
          <div class="dl-section">
            <div class="dl-label">RADAR SIGNATURE — BLIP SHAPE</div>
            <div class="dl-shapes" id="dl-shapes">
              ${RADAR_SHAPES.map(s => `
                <div class="dl-shape ${s.id === id.radarShape ? 'active' : ''}"
                     data-shape="${s.id}">
                  ${s.label}
                  <span class="dl-shape-hint">${s.hint}</span>
                </div>
              `).join('')}
            </div>
          </div>

          <!-- Blueprint sliders -->
          <div class="dl-section">
            <div class="dl-label">DRONE BLUEPRINT — TRADEOFFS (لا مجال للمثالية)</div>

            <div class="dl-slider-row">
              <span class="dl-slider-side">SPEED</span>
              <input class="dl-range" id="bp-sa" type="range" min="0" max="100"
                     value="${Math.round(id.blueprint.speedArmor * 100)}" />
              <span class="dl-slider-side right">ARMOR</span>
            </div>
            <div class="dl-preview" id="prev-sa"></div>

            <div class="dl-slider-row">
              <span class="dl-slider-side">DAMAGE</span>
              <input class="dl-range" id="bp-dfr" type="range" min="0" max="100"
                     value="${Math.round(id.blueprint.damageFireRate * 100)}" />
              <span class="dl-slider-side right">FIRE RATE</span>
            </div>
            <div class="dl-preview" id="prev-dfr"></div>

            <div class="dl-slider-row">
              <span class="dl-slider-side">RANGE</span>
              <input class="dl-range" id="bp-ra" type="range" min="0" max="100"
                     value="${Math.round(id.blueprint.rangeAggression * 100)}" />
              <span class="dl-slider-side right">AGGRESSION</span>
            </div>
            <div class="dl-preview" id="prev-ra"></div>
          </div>

          <button class="dl-deploy" id="dl-deploy">▶  DEPLOY TO FIELD</button>
        </div>
      `;

      document.body.appendChild(el);

      // ── State ──────────────────────────────────────────────────────────
      let selectedColor = TEAM_COLORS.find(c => c.color === id.teamColor) ?? TEAM_COLORS[0];
      let selectedShape = id.radarShape;

      // ── Color swatches ──────────────────────────────────────────────────
      el.querySelectorAll('.dl-swatch').forEach(sw => {
        sw.addEventListener('click', () => {
          el.querySelectorAll('.dl-swatch').forEach(s => s.classList.remove('active'));
          sw.classList.add('active');
          selectedColor = TEAM_COLORS[+sw.dataset.idx];
        });
      });

      // ── Shape picker ────────────────────────────────────────────────────
      el.querySelectorAll('.dl-shape').forEach(sh => {
        sh.addEventListener('click', () => {
          el.querySelectorAll('.dl-shape').forEach(s => s.classList.remove('active'));
          sh.classList.add('active');
          selectedShape = sh.dataset.shape;
        });
      });

      // ── Slider previews ─────────────────────────────────────────────────
      const previews = [
        { id: 'bp-sa',  prevId: 'prev-sa',  left: 'SPEED',  right: 'ARMOR'     },
        { id: 'bp-dfr', prevId: 'prev-dfr', left: 'DAMAGE', right: 'FIRE RATE' },
        { id: 'bp-ra',  prevId: 'prev-ra',  left: 'RANGE',  right: 'AGGRESSION'},
      ];

      previews.forEach(({ id: sid, prevId, left, right }) => {
        const slider = el.querySelector(`#${sid}`);
        const prev   = el.querySelector(`#${prevId}`);
        const refresh = () => {
          const v = +slider.value;
          const offset = v - 50;
          if (Math.abs(offset) < 4) { prev.textContent = '— balanced —'; return; }
          const pct = Math.round(Math.abs(offset) * 0.8);
          prev.textContent = offset < 0
            ? `▲ ${left} +${pct}%`
            : `▲ ${right} +${pct}%`;
        };
        slider.addEventListener('input', refresh);
        refresh();
      });

      // ── Deploy ──────────────────────────────────────────────────────────
      el.querySelector('#dl-deploy').addEventListener('click', () => {
        const callsign = (el.querySelector('#dl-callsign').value.trim().toUpperCase() || 'ALPHA').slice(0, 8);
        const bp = {
          speedArmor:      +el.querySelector('#bp-sa').value  / 100,
          damageFireRate:  +el.querySelector('#bp-dfr').value / 100,
          rangeAggression: +el.querySelector('#bp-ra').value  / 100,
        };
        el.remove();
        resolve({
          callsign,
          teamColor:  selectedColor.color,
          teamShadow: selectedColor.shadow,
          radarShape: selectedShape,
          blueprint:  bp,
        });
      });
    });
  }
}
