import { FORMATIONS, FORMATION_BOIDS } from '../ai/Formations.js';
import { t, setLang, getLang, onLangChange } from '../data/Locale.js';

/**
 * CockpitHUD — military commander DOM/canvas overlay.
 *
 * Phase 1 features:
 *  • Glassmorphism panels   — backdrop-filter blur, dark glass aesthetic
 *  • Command Web SVG        — drone groups shown as aircraft icons connected
 *                             by tactical lines to objective nodes
 *  • Spatial Radar          — dedicated canvas with CSS perspective tilt,
 *                             replaces the old flat mini-map on main canvas
 *  • Top bar + corner marks — callsign / wave / mission / clock
 */
export class CockpitHUD {

  /** @param {import('../core/Game.js').Game} game */
  constructor(game) {
    this.game        = game;
    this._born       = Date.now();
    this._throttle   = 0;
    this.radarCanvas = null;  // set in _inject()
    this._mx         = 0;
    this._my         = 0;
    this._inject();
    this._initParallax();
  }

  // ── DOM construction ────────────────────────────────────────────────────

  _inject() {
    const root = document.getElementById('game-container');

    // ── 1. Cockpit frame (top-bar + corner brackets) ──────────────────────
    const frame = document.createElement('div');
    frame.id = 'cf-frame';
    frame.innerHTML = `
      <div id="cf-topbar">
        <span id="cf-callsign" class="cf-dim">VULTURE-CMD</span>
        <span class="cf-sep">|</span>
        <span id="cf-wave">WAVE 1</span>
        <span class="cf-sep">|</span>
        <span id="cf-mission" class="cf-mission" data-i18n="mission.defend">${t('mission.defend')}</span>
        <span class="cf-spacer"></span>
        <span id="cf-time" class="cf-dim">00:00</span>
      </div>
      <div class="cf-corner cf-tl"></div>
      <div class="cf-corner cf-tr"></div>
      <div class="cf-corner cf-bl"></div>
      <div class="cf-corner cf-br"></div>
    `;
    root.appendChild(frame);

    // ── 2. Right command panel ─────────────────────────────────────────────
    const panel = document.createElement('div');
    panel.id = 'cf-panel';
    panel.innerHTML = `
      <div class="cf-panel-header">
        <span data-i18n="panel.cmd_intel">${t('panel.cmd_intel')}</span>
        <button id="cf-lang-toggle" class="cf-lang-btn" title="${t('lang.toggle_title')}">${t('lang.toggle')}</button>
      </div>

      <div id="cf-cmd-danger" class="cf-cmd-danger hidden">
        <span class="cf-cmd-icon">★</span>
        <span class="cf-cmd-text" data-i18n="danger.active_ar">${t('danger.active_ar')}</span>
        <span class="cf-cmd-sub"  data-i18n="danger.active_en">${t('danger.active_en')}</span>
      </div>

      <div class="cf-section">
        <div class="cf-section-label" data-i18n="section.objectives">${t('section.objectives')}</div>
        <div id="cf-objectives"></div>
      </div>

      <div class="cf-section">
        <div class="cf-section-label" data-i18n="section.command_web">${t('section.command_web')}</div>
        <svg id="cf-web" viewBox="0 0 238 130"
             xmlns="http://www.w3.org/2000/svg"></svg>
      </div>

      <div class="cf-section">
        <div class="cf-section-label" data-i18n="section.threat_grid">${t('section.threat_grid')}</div>
        <div class="cf-threat-row">
          <div class="cf-grid" id="cf-sectors">
            ${[0,1,2,3,4,5,6,7,8].map(i =>
              i === 4
                ? `<div class="cf-cell cf-cell-cmd" id="cc-4">CMD</div>`
                : `<div class="cf-cell" id="cc-${i}"></div>`
            ).join('')}
          </div>
          <div id="cf-advisory"></div>
        </div>
        <div id="cf-cmd-hp-row" class="cf-cmd-hp-row hidden">
          <span class="cf-cmd-hp-label" data-i18n="cmd.hp_label">${t('cmd.hp_label')}</span>
          <div class="cf-cmd-hp-track">
            <div id="cf-cmd-hp-fill" class="cf-cmd-hp-fill"></div>
          </div>
          <span id="cf-cmd-hp-pct" class="cf-cmd-hp-pct">100%</span>
        </div>
      </div>

      <div class="cf-section cf-section-footer">
        <span id="cf-kills"  class="cf-green">⬡ 0</span>
        <span id="cf-losses" class="cf-red">✗ 0</span>
        <span id="cf-score"  class="cf-dim">0 <span data-i18n="stat.score_suffix">${t('stat.score_suffix')}</span></span>
      </div>

      <div class="cf-section cf-section-formation">
        <div class="cf-formation-row">
          <span class="cf-section-label" data-i18n="section.formation">${t('section.formation')}</span>
          <span id="cf-formation" class="cf-green">${t('f.watch')}</span>
          <span class="cf-dim cf-formation-keys">[Z/C/V/B/N]</span>
        </div>
        <div class="cf-formation-body">
          <svg id="cf-formation-svg" class="cf-formation-svg"
               viewBox="0 0 80 60" xmlns="http://www.w3.org/2000/svg"></svg>
          <div id="cf-formation-hint" class="cf-formation-hint-text"></div>
        </div>
      </div>

      <div class="cf-section cf-section-resources">
        <div class="cf-resource-row">
          <span class="cf-section-label" data-i18n="section.sonar">${t('section.sonar')}</span>
          <div id="cf-sonar-pips" class="cf-pips"></div>
          <span class="cf-dim cf-res-keys">[Q/W/F]</span>
        </div>
        <div class="cf-resource-row">
          <span class="cf-section-label" data-i18n="section.emp">${t('section.emp')}</span>
          <div id="cf-emp-pips" class="cf-pips"></div>
          <span class="cf-dim cf-res-keys">[X]</span>
        </div>
      </div>
    `;
    root.appendChild(panel);

    // ── Language toggle button handler ────────────────────────────────────────
    setTimeout(() => {
      const langBtn = document.getElementById('cf-lang-toggle');
      if (langBtn) {
        langBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          const next = getLang() === 'ar' ? 'en' : 'ar';
          setLang(next);
          langBtn.textContent = t('lang.toggle');
          langBtn.title = t('lang.toggle_title');
          // Also refresh mission text in top bar
          const missionEl = document.getElementById('cf-mission');
          if (missionEl) missionEl.textContent = t('mission.defend');
        });
      }
    }, 0);

    // ── 3. Spatial Radar (separate canvas + perspective CSS wrapper) ────────
    const radarWrap = document.createElement('div');
    radarWrap.id = 'cf-radar-wrap';

    const radarCv = document.createElement('canvas');
    radarCv.id     = 'cf-radar-cv';
    radarCv.width  = 220;
    radarCv.height = 155;

    const radarLabel = document.createElement('div');
    radarLabel.id = 'cf-radar-label';
    radarLabel.innerHTML = `
      <span id="cf-rl-squad">IRONHAWK</span>
      <span class="cf-rl-sep">|</span>
      <span data-i18n="radar.type">${t('radar.type')}</span>
      <span class="cf-rl-sep">|</span>
      <span id="cf-rl-grid">GRID: H-7</span>
    `;

    radarWrap.appendChild(radarCv);
    radarWrap.appendChild(radarLabel);
    root.appendChild(radarWrap);
    this.radarCanvas = radarCv;

    // ── 4. Command Cubes overlay ───────────────────────────────────────────
    this._injectCommandCubes(root);

    // ── 5. Group-switch banner (center screen, transient) ──────────────────
    const grpBanner = document.createElement('div');
    grpBanner.id = 'cf-grp-banner';
    grpBanner.className = 'cf-grp-banner hidden';
    root.appendChild(grpBanner);
    this._grpBannerTimer = 0;

    // ── 6. Placement mode instruction bar (bottom of screen) ───────────────
    const placementBar = document.createElement('div');
    placementBar.id = 'cf-placement-bar';
    placementBar.className = 'cf-placement-bar hidden';
    placementBar.innerHTML = `
      <span id="cf-pb-icon"></span>
      <span id="cf-pb-text"></span>
      <span id="cf-pb-charges"></span>
      <span class="cf-pb-cancel">[Escape / ضغطة ثانية للإلغاء]</span>
    `;
    root.appendChild(placementBar);
  }

  _injectCommandCubes(root) {
    const g = this.game;

    // Action cube definitions
    const actions = [
      { key: '1', icon: '✈✈',  label: '+5 مسيّرات\nعادية',  cost: 150,              type: 'action' },
      { key: '2', icon: '◈◈',  label: '+3 مسيّرات\nثقيلة',  cost: 220,              type: 'action' },
      { key: '3', icon: '⊙',   label: 'مسح مداري\n4s كشف',  cost: g.ORBITAL_SCAN_COST, type: 'action' },
    ];
    const sonarCubes = [
      { key: 'Q', icon: '📡', label: 'Full Sweep\n3s كشف كامل', type: 'sonar', charge: 'sweep'   },
      { key: 'W', icon: '◎',  label: 'Focus Pulse\nنبضة تركيز', type: 'sonar', charge: 'focus'   },
      { key: 'F', icon: '👁', label: 'Stealth\nكشف التخفي',    type: 'sonar', charge: 'stealth' },
    ];

    const wrap = document.createElement('div');
    wrap.id = 'cf-cubes';
    wrap.classList.add('hidden');

    const makeCube = (def) => {
      const cube = document.createElement('div');
      const isSonar = def.type === 'sonar';
      cube.className = `cf-cube${isSonar ? ' cf-cube-sonar' : ''}`;
      cube.innerHTML = `
        <div class="cf-cube-icon">${def.icon}</div>
        <div class="cf-cube-label">${def.label.replace(/\n/g, '<br>')}</div>
        <div class="cf-cube-footer">
          <span class="cf-cube-key">[${def.key}]</span>
          ${isSonar
            ? `<span class="cf-cube-charge" id="cc-charge-${def.charge}">⬡ 0</span>`
            : `<span class="cf-cube-cost">${def.cost} pts</span>`}
        </div>
      `;
      cube.addEventListener('click', () => {
        if (def.type === 'action') {
          g._quickAction(parseInt(def.key));
        } else {
          g._useSonarCharge(def.charge);
          g._quickMenuOpen = false;
          wrap.classList.add('hidden');
        }
      });
      return cube;
    };

    wrap.innerHTML = `
      <div class="cf-cubes-bg"></div>
    `;

    const panel = document.createElement('div');
    panel.className = 'cf-cubes-panel';
    panel.innerHTML = `<div class="cf-cubes-title">⚡ COMMAND CENTER  —  IRONHAWK</div>`;

    // Action row
    const rowA = document.createElement('div');
    rowA.className = 'cf-cubes-row';
    actions.forEach(def => rowA.appendChild(makeCube(def)));
    panel.appendChild(rowA);

    panel.innerHTML += `<div class="cf-cubes-divider"></div>`;

    // Sonar row
    const rowS = document.createElement('div');
    rowS.className = 'cf-cubes-row';
    sonarCubes.forEach(def => rowS.appendChild(makeCube(def)));
    panel.appendChild(rowS);

    panel.innerHTML += `<div class="cf-cubes-hint">[R] / [ESC] CLOSE</div>`;

    // Click on backdrop closes
    wrap.querySelector('.cf-cubes-bg').addEventListener('click', () => {
      g._quickMenuOpen = false;
      wrap.classList.add('hidden');
    });

    wrap.appendChild(panel);
    root.appendChild(wrap);
    this._cubesEl = wrap;
  }

  // ── Public API ──────────────────────────────────────────────────────────

  /**
   * Show the center-screen group-switch banner.
   * @param {string} groupId  — 'A' | 'B' | 'C' | 'D'
   * @param {number} count    — number of drones in that group
   */
  showGroupBanner(groupId, count) {
    const NAMES = { A: 'ALPHA', B: 'BRAVO', C: 'CHARLIE', D: 'DELTA' };
    const COLORS = { A: '#00e87a', B: '#00ccff', C: '#ffaa00', D: '#ff6688' };
    const el = document.getElementById('cf-grp-banner');
    if (!el) return;
    el.style.color      = COLORS[groupId] ?? '#00e87a';
    el.style.borderColor = COLORS[groupId] ?? '#00e87a';
    el.innerHTML = `
      <span class="cf-grp-id">${NAMES[groupId] ?? groupId}</span>
      <span class="cf-grp-count">${count} مسيّرة نشطة</span>
    `;
    el.classList.remove('hidden', 'cf-grp-fadeout');
    this._grpBannerTimer = 1.5;
  }

  /** Call every frame (throttled internally). */
  update(dt) {
    // Tick the group banner fade (unthrottled — needs smooth fade)
    if (this._grpBannerTimer > 0) {
      this._grpBannerTimer -= dt;
      const el = document.getElementById('cf-grp-banner');
      if (el) {
        const alpha = Math.min(1, this._grpBannerTimer / 0.4);
        el.style.opacity = alpha;
        if (this._grpBannerTimer <= 0) el.classList.add('hidden');
      }
    }

    this._throttle -= dt;
    if (this._throttle > 0) return;
    this._throttle = 0.12;

    const g = this.game;
    this._updateTopBar(g);
    this._updateObjectives(g);
    this._updateCommandWeb(g);
    this._updateThreat(g);
    this._updateCommanderDanger(g);
    this._updateCommanderHp(g);
    this._updateResources(g);
    this._updatePlacementBar(g);
    this._updateFormationPreview(g);
    this._updateFooter(g);
    this._updateRadarLabel(g);
    this._updateCommandCubes(g);
    this._updateAlertStates(g);
  }

  /** Draw the spatial radar onto its own canvas — call every frame for smooth sweep. */
  drawRadar(game) {
    const cv = this.radarCanvas;
    if (!cv) return;
    if (game._scoutIntro || game._awaitingUpgrade) {
      const ctx = cv.getContext('2d');
      ctx.clearRect(0, 0, cv.width, cv.height);
      return;
    }

    const ctx = cv.getContext('2d');
    const W = cv.width, H = cv.height;
    const gW = game.canvas.width, gH = game.canvas.height;
    const sx = W / gW, sy = H / gH;
    const toR = (x, y) => ({ x: x * sx, y: y * sy });

    ctx.clearRect(0, 0, W, H);

    // Background
    ctx.fillStyle = 'rgba(0, 6, 3, 0.88)';
    ctx.fillRect(0, 0, W, H);

    // Grid lines
    ctx.strokeStyle = 'rgba(0, 180, 80, 0.12)';
    ctx.lineWidth = 0.5;
    for (let x = 0; x <= W; x += W / 5) {
      ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke();
    }
    for (let y = 0; y <= H; y += H / 4) {
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke();
    }

    // Sector grid labels (H-7 style like reference image)
    ctx.font = '6px monospace';
    ctx.fillStyle = 'rgba(0, 180, 80, 0.32)';
    ctx.textAlign = 'left';
    const cols = ['H', 'K', 'M', 'R', 'S'];
    const rows = [6, 7, 8, 9, 10];
    for (let r = 0; r < 4; r++) {
      for (let c = 0; c < 5; c++) {
        ctx.fillText(`${cols[c]}-${rows[r]}`, c * (W / 5) + 2, r * (H / 4) + 9);
      }
    }

    // Enemy base
    if (game._enemyBase && !game._enemyBase.dead) {
      const p = toR(game._enemyBase.x, game._enemyBase.y);
      const col = game._enemyBase._shielded ? '#4488ff' : '#ff6600';
      ctx.fillStyle = col;
      ctx.shadowColor = col; ctx.shadowBlur = 6;
      ctx.fillRect(p.x - 3, p.y - 3, 6, 6);
      ctx.shadowBlur = 0;
    }

    // Objectives
    for (const obj of game.objectives) {
      const p = toR(obj.x, obj.y);
      const hp = obj.health / obj.maxHealth;
      const col = obj.health <= 0 ? '#ff3333' : hp > 0.5 ? '#00ff88' : '#ffaa00';
      ctx.fillStyle = col; ctx.shadowColor = col; ctx.shadowBlur = 6;
      ctx.beginPath(); ctx.arc(p.x, p.y, 4, 0, Math.PI * 2); ctx.fill();
      ctx.shadowBlur = 0;
      ctx.font = '8px sans-serif'; ctx.fillStyle = col; ctx.textAlign = 'left';
      ctx.fillText(obj._icon ?? '○', p.x + 5, p.y + 3);
    }

    // Enemy drones
    const _roleIcons = {
      rusher:'◆', flanker:'◀', sniper:'▲',
      stealth:'◾', kamikaze:'✕', commander:'★', boss:'⬡',
    };
    for (const e of game.enemySwarm.drones) {
      if (e.dead) continue;
      const p = toR(e.x, e.y);
      const big = e.role === 'boss' || e.role === 'commander';
      const col = e._roleColor ?? '#ff4444';
      ctx.globalAlpha = big ? 0.95 : 0.72;
      ctx.fillStyle = col;
      ctx.beginPath(); ctx.arc(p.x, p.y, big ? 3 : 1.5, 0, Math.PI * 2); ctx.fill();
      if (big || e.role === 'sniper' || e.role === 'kamikaze') {
        ctx.font = `bold ${big ? 6 : 5}px monospace`;
        ctx.fillStyle = col; ctx.textAlign = 'center';
        ctx.fillText(_roleIcons[e.role] ?? '●', p.x, p.y - (big ? 4 : 3));
      }
    }
    ctx.globalAlpha = 1;

    // Player drones
    ctx.fillStyle = '#00ccff';
    for (const d of game.playerSwarm.drones) {
      if (d.dead) continue;
      const p = toR(d.x, d.y);
      ctx.globalAlpha = 0.80;
      ctx.beginPath(); ctx.arc(p.x, p.y, 1.5, 0, Math.PI * 2); ctx.fill();
    }
    ctx.globalAlpha = 1;

    // Radar sweep line
    const mc = toR(gW / 2, gH / 2);
    const mR = Math.sqrt(W * W + H * H);
    ctx.strokeStyle = 'rgba(0, 255, 100, 0.40)';
    ctx.lineWidth = 1;
    ctx.shadowColor = '#00ff66'; ctx.shadowBlur = 3;
    ctx.beginPath();
    ctx.moveTo(mc.x, mc.y);
    ctx.lineTo(
      mc.x + Math.cos(game.radarSweep.angle) * mR,
      mc.y + Math.sin(game.radarSweep.angle) * mR
    );
    ctx.stroke();
    ctx.shadowBlur = 0;

    // Border
    ctx.strokeStyle = 'rgba(0, 200, 80, 0.28)';
    ctx.lineWidth = 1; ctx.textAlign = 'left';
    ctx.strokeRect(0, 0, W, H);
  }

  reset() {
    this._born = Date.now();
    if (this._cubesEl) this._cubesEl.classList.add('hidden');
  }

  // ── Command Cubes ─────────────────────────────────────────────────────────

  _updateCommandCubes(g) {
    if (!this._cubesEl) return;

    // Show/hide based on game state
    if (g._quickMenuOpen) {
      this._cubesEl.classList.remove('hidden');
    } else {
      this._cubesEl.classList.add('hidden');
      return;
    }

    // Update affordability on action cubes
    const COSTS = { 1: 150, 2: 220, 3: g.ORBITAL_SCAN_COST };
    const actionCubes = this._cubesEl.querySelectorAll('.cf-cube:not(.cf-cube-sonar)');
    actionCubes.forEach((cube, i) => {
      const cost = COSTS[i + 1] ?? 0;
      cube.classList.toggle('cf-cube-off', g.score < cost);
    });

    // Update sonar charge counts + affordability
    const chargeTypes = ['sweep', 'focus', 'stealth'];
    chargeTypes.forEach(type => {
      const el = document.getElementById(`cc-charge-${type}`);
      if (el) el.textContent = `⬡ ${g._sonarCharges}`;
    });
    const sonarCubes = this._cubesEl.querySelectorAll('.cf-cube-sonar');
    sonarCubes.forEach(cube => {
      cube.classList.toggle('cf-cube-off', g._sonarCharges <= 0);
    });

    // Update callsign in title
    const title = this._cubesEl.querySelector('.cf-cubes-title');
    if (title) {
      const cs = g._playerIdentity?.callsign || 'IRONHAWK';
      title.textContent = `⚡ COMMAND CENTER  —  ${cs}`;
    }
  }

  // ── Parallax ─────────────────────────────────────────────────────────────

  _initParallax() {
    this._mx = window.innerWidth  / 2;
    this._my = window.innerHeight / 2;
    let pending = false;

    window.addEventListener('mousemove', (e) => {
      this._mx = e.clientX;
      this._my = e.clientY;
      if (!pending) {
        pending = true;
        requestAnimationFrame(() => { this._applyParallax(); pending = false; });
      }
    });
  }

  _applyParallax() {
    const cx = window.innerWidth  / 2;
    const cy = window.innerHeight / 2;
    const nx = (this._mx - cx) / cx;  // –1 … +1
    const ny = (this._my - cy) / cy;

    // Right panel — drifts opposite to mouse (far layer, 3px max)
    const panel = document.getElementById('cf-panel');
    if (panel) panel.style.transform =
      `translateX(${-nx * 3}px) translateY(${-ny * 2}px)`;

    // Top bar — subtle vertical drift only (1.5px max)
    const topbar = document.getElementById('cf-topbar');
    if (topbar) topbar.style.transform = `translateY(${-ny * 1.5}px)`;

    // Corner brackets — each drifts toward its own corner (4px max)
    //  TL=0  TR=1  BL=2  BR=3
    const signs = [[-1,-1],[1,-1],[-1,1],[1,1]];
    document.querySelectorAll('.cf-corner').forEach((el, i) => {
      const [sx, sy] = signs[i] ?? [0, 0];
      el.style.transform = `translate(${sx * nx * 4}px, ${sy * ny * 4}px)`;
    });

    // Spatial radar — moves slightly with mouse (closer layer, same direction, 6px)
    const radar = document.getElementById('cf-radar-wrap');
    if (radar) radar.style.transform =
      `perspective(560px) rotateX(30deg) translateX(${nx * 6}px)`;
  }

  // ── Alert states (driven by game threat level) ────────────────────────────

  _updateAlertStates(g) {
    const enemies    = g.enemySwarm.drones.filter(d => !d.dead).length;
    const anyCrit    = g.objectives.some(o => o.health > 0 && o.health / o.maxHealth < 0.30);
    const highThreat = enemies > 8 || anyCrit;
    const isBoss     = g.wave % 5 === 0 && g.wave > 0;

    // Corner brackets → red pulse when high threat
    document.querySelectorAll('.cf-corner').forEach(el =>
      el.classList.toggle('cf-alert', highThreat));

    // Top bar → orange border pulse on boss wave
    document.getElementById('cf-topbar')?.classList.toggle('cf-boss', isBoss);

    // Advisory → urgent flash when enemies present
    document.getElementById('cf-advisory')?.classList.toggle('cf-urgent', enemies > 4);
  }

  // ── Top bar ─────────────────────────────────────────────────────────────

  _updateTopBar(g) {
    const sec = Math.floor((Date.now() - this._born) / 1000);
    const mm  = String(Math.floor(sec / 60)).padStart(2, '0');
    const ss  = String(sec % 60).padStart(2, '0');
    const boss = g.wave % 5 === 0 && g.wave > 0;

    _set('cf-callsign', g._playerIdentity?.callsign || 'VULTURE-CMD');
    _set('cf-wave',     `WAVE ${g.wave}`);
    _set('cf-time',     `${mm}:${ss}`);

    const mEl = document.getElementById('cf-mission');
    if (mEl) {
      mEl.textContent = boss ? '⚠ BOSS WAVE — HIGH THREAT' : 'DEFEND CITY GRID';
      mEl.style.color = boss ? '#ff6633' : 'var(--cf-green)';
    }
  }

  // ── Objectives ──────────────────────────────────────────────────────────

  _updateObjectives(g) {
    const el = document.getElementById('cf-objectives');
    if (!el) return;

    // Arabic full names + output rate labels per resource type
    const OBJ_META = {
      power: { ar: 'محطة الطاقة',  unit: 'كيلوواط', rateBase: 24 },
      water: { ar: 'خزان المياه',  unit: 'م³/د',    rateBase: 18 },
      food:  { ar: 'مزرعة الغذاء', unit: 'وحدة/د',  rateBase: 14 },
    };

    el.innerHTML = g.objectives.map(obj => {
      const pct   = obj.health <= 0 ? 0 : obj.health / obj.maxHealth;
      const color = pct > 0.6 ? '#00e87a' : pct > 0.3 ? '#ffaa00' : '#ff3333';
      const meta  = OBJ_META[obj.resourceType] ?? OBJ_META.power;
      const arName = meta.ar;
      const icon  = obj._icon ?? '⚡';
      const crit       = pct > 0 && pct <= 0.30;
      const threatened = (obj._threatCount ?? 0) > 0;
      const destroyed  = obj.health <= 0;

      // Resource output rate — proportional to HP%, rounded
      const rate    = destroyed ? 0 : Math.round(meta.rateBase * pct);
      const rateMax = meta.rateBase;
      const rateColor = pct > 0.6 ? '#55cc88' : pct > 0.3 ? '#ddaa44' : '#cc4444';

      const statusTxt = destroyed ? 'مُدمَّر ✗'
                      : crit      ? '⚠ حرج'
                      : `${Math.floor(pct * 100)}%`;

      return `
        <div class="cf-obj-card${threatened ? ' cf-threatened' : ''}${crit ? ' cf-crit-card' : ''}${destroyed ? ' cf-destroyed-card' : ''}">
          <div class="cf-obj-header">
            <span class="cf-obj-icon">${icon}</span>
            <span class="cf-obj-arname" style="color:${color}">${arName}</span>
            <span class="cf-obj-status" style="color:${color}">${statusTxt}</span>
          </div>
          <div class="cf-bar-track">
            <div class="cf-bar-fill${crit ? ' cf-crit' : ''}"
                 style="width:${Math.floor(pct*100)}%;background:${color}"></div>
          </div>
          <div class="cf-obj-rate">
            <span style="color:${rateColor}">${rate} / ${rateMax} ${meta.unit}</span>
            ${threatened ? `<span class="cf-obj-threat">▲ ×${obj._threatCount}</span>` : ''}
          </div>
        </div>`;
    }).join('');
  }

  // ── Command Web ──────────────────────────────────────────────────────────

  _updateCommandWeb(g) {
    const svg = document.getElementById('cf-web');
    if (!svg) return;

    const objs  = g.objectives;
    const all   = g.playerSwarm.drones;
    const kia   = all.filter(d => d.dead).length;
    const avgHp = arr => arr.length === 0 ? 0
      : arr.reduce((s, d) => s + d.hp / (d.maxHp || 1), 0) / arr.length;
    const hpColor = p => p > 0.6 ? '#00e87a' : p > 0.3 ? '#ffaa00' : '#ff3333';
    const form  = (g.playerSwarm.currentFormation ?? 'watch').toUpperCase();
    const activeGrp = g.playerSwarm.activeGroup;

    // Build group data for each letter that has alive drones
    const GROUP_META = {
      A: { label: 'ALPHA',   color: '#00e87a' },
      B: { label: 'BRAVO',   color: '#00ccff' },
      C: { label: 'CHARLIE', color: '#ffaa00' },
      D: { label: 'DELTA',   color: '#ff6688' },
    };
    const rawGroups = ['A','B','C','D'].map(g2 => ({
      id:     g2,
      drones: all.filter(d => !d.dead && d._group === g2),
      ...GROUP_META[g2],
    })).filter(g2 => g2.drones.length > 0);

    // Evenly space group nodes along the bottom of the SVG (238px wide)
    const nodeY = 94;
    const spacing = rawGroups.length > 1 ? 200 / (rawGroups.length - 1) : 0;
    const startX = rawGroups.length === 1 ? 119 : 19 + spacing * 0;
    const grpData = rawGroups.map((g2, i) => ({
      ...g2,
      x:  rawGroups.length === 1 ? 119 : 19 + i * spacing,
      y:  nodeY,
      hp: avgHp(g2.drones),
      form: g2.id === activeGrp ? form : '',
      active: g2.id === activeGrp,
    }));

    // Fixed positions: objective nodes top
    const OBJ_POS = [
      { x: 40,  y: 22 },
      { x: 119, y: 22 },
      { x: 198, y: 22 },
    ];

    let html = `<defs>
      <filter id="gw" x="-60%" y="-60%" width="220%" height="220%">
        <feGaussianBlur in="SourceGraphic" stdDeviation="1.8" result="b"/>
        <feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge>
      </filter>
    </defs>`;

    // Connection lines: each group to each objective
    for (const grp of grpData) {
      for (let oi = 0; oi < OBJ_POS.length && oi < objs.length; oi++) {
        const op  = OBJ_POS[oi];
        const obj = objs[oi];
        const hot = (obj?._threatCount ?? 0) > 0;
        const lc  = hot
          ? (grp.active ? 'rgba(255,120,0,0.55)' : 'rgba(255,100,0,0.18)')
          : (grp.active ? 'rgba(0,210,100,0.45)' : 'rgba(0,210,100,0.10)');
        const lw  = grp.active ? 1.2 : 0.6;
        html += `<line x1="${grp.x}" y1="${grp.y - 11}"
                       x2="${op.x}"  y2="${op.y + 8}"
                       stroke="${lc}" stroke-width="${lw}" stroke-dasharray="3,5"/>`;
      }
    }

    // Objective nodes
    for (let i = 0; i < OBJ_POS.length && i < objs.length; i++) {
      const op   = OBJ_POS[i];
      const obj  = objs[i];
      const hp   = obj.health <= 0 ? 0 : obj.health / obj.maxHealth;
      const col  = hp <= 0 ? '#440000' : hp > 0.5 ? '#00e87a' : '#ffaa00';
      const icon = obj._icon ?? '○';
      const hot  = (obj._threatCount ?? 0) > 0;

      // Glow ring when threatened
      if (hot) {
        html += `<circle cx="${op.x}" cy="${op.y}" r="9"
          fill="none" stroke="rgba(255,80,0,0.35)" stroke-width="1.5"
          opacity="0.9"/>`;
      }
      // Node circle
      html += `<circle cx="${op.x}" cy="${op.y}" r="6"
        fill="rgba(0,16,8,0.85)" stroke="${col}" stroke-width="1"
        filter="url(#gw)"/>`;
      html += `<text x="${op.x}" y="${op.y + 4}" text-anchor="middle"
        font-size="8" fill="${col}">${icon}</text>`;

      // HP arc
      if (hp > 0 && hp < 1) {
        const angle = hp * 2 * Math.PI;
        const ex = op.x + 9 * Math.cos(-Math.PI / 2 + angle);
        const ey = op.y + 9 * Math.sin(-Math.PI / 2 + angle);
        const lg = hp > 0.5 ? 1 : 0;
        html += `<path d="M ${op.x} ${op.y - 9} A 9 9 0 ${lg} 1 ${ex} ${ey}"
          stroke="${col}" stroke-width="1.5" fill="none" opacity="0.65"/>`;
      }
    }

    // Group nodes — aircraft chevron shape with per-group color
    const t = Date.now() / 1000;
    for (const grp of grpData) {
      const cx  = grp.x, cy = grp.y;
      const col = hpColor(grp.hp);
      const accentCol = grp.color;
      const inactive  = !grp.active;

      if (grp.active) {
        // Outer slow pulse ring
        const p1 = 0.55 + 0.45 * Math.sin(t * 2.2);
        html += `<circle cx="${cx}" cy="${cy - 4}" r="17"
          fill="none" stroke="${accentCol}" stroke-width="1.5"
          opacity="${p1.toFixed(2)}" stroke-dasharray="4,3"/>`;
        // Inner solid ring
        const p2 = 0.70 + 0.30 * Math.sin(t * 3.5);
        html += `<circle cx="${cx}" cy="${cy - 4}" r="13"
          fill="none" stroke="${accentCol}" stroke-width="1"
          opacity="${p2.toFixed(2)}"/>`;
        // Filled background highlight
        html += `<circle cx="${cx}" cy="${cy - 4}" r="12"
          fill="${accentCol}" opacity="0.08"/>`;
      }

      // Chevron — dimmed when not active
      html += `
        <polygon points="${cx},${cy-11} ${cx-7},${cy+3} ${cx},${cy} ${cx+7},${cy+3}"
          fill="${col}" opacity="${inactive ? 0.35 : 0.85}" filter="url(#gw)"/>
        <text x="${cx}" y="${cy + 18}" text-anchor="middle"
          font-size="7" fill="${inactive ? 'rgba(180,180,180,0.45)' : accentCol}"
          font-family="monospace" font-weight="bold">${grp.label}</text>
        <text x="${cx}" y="${cy + 27}" text-anchor="middle"
          font-size="7" fill="${inactive ? 'rgba(180,180,180,0.35)' : col}"
          font-family="monospace"
          opacity="${inactive ? 0.4 : 0.75}">×${grp.drones.length} ${Math.floor(grp.hp * 100)}%</text>`;
      if (grp.form) {
        html += `<text x="${cx}" y="${cy + 36}" text-anchor="middle"
          font-size="6" fill="${accentCol}" font-family="monospace" opacity="0.55">${grp.form}</text>`;
      }
    }

    // KIA tag
    if (kia > 0) {
      html += `<text x="4" y="126" font-size="7" fill="#ff3333"
        font-family="monospace">✗ KIA ×${kia}</text>`;
    }

    svg.innerHTML = html;
  }

  // ── Threat grid ──────────────────────────────────────────────────────────

  static _SECTOR_NAMES = ['NW','N','NE','W','','E','SW','S','SE'];
  static _SECTOR_DIRS  = ['NW','NORTH','NE','WEST','','EAST','SW','SOUTH','SE'];

  _updateThreat(g) {
    const W = g.canvas.width, H = g.canvas.height;
    const cx = W / 2, cy = H / 2;
    const counts = new Array(9).fill(0);

    for (const d of g.enemySwarm.drones) {
      if (d.dead) continue;
      const col = Math.max(0, Math.min(2, Math.round((d.x - cx) / (cx * 0.9) + 1)));
      const row = Math.max(0, Math.min(2, Math.round((d.y - cy) / (cy * 0.9) + 1)));
      const si  = row * 3 + col;
      if (si !== 4) counts[si]++;
    }

    const names = CockpitHUD._SECTOR_NAMES;
    for (let i = 0; i < 9; i++) {
      if (i === 4) continue;
      const cell = document.getElementById(`cc-${i}`);
      if (!cell) continue;
      cell.textContent = counts[i] > 0 ? counts[i] : names[i];
      cell.className   = 'cf-cell' + (counts[i] > 0 ? ' cf-cell-hot' : '');
    }

    const advisory = document.getElementById('cf-advisory');
    if (!advisory) return;

    const total = g.enemySwarm.drones.filter(d => !d.dead).length;
    if (total === 0) {
      advisory.innerHTML = '<span class="cf-green">SECTOR CLEAR</span>';
      return;
    }
    let hotIdx = 0;
    for (let i = 1; i < 9; i++) {
      if (i !== 4 && counts[i] > counts[hotIdx]) hotIdx = i;
    }
    const roleCounts = {};
    for (const d of g.enemySwarm.drones) {
      if (!d.dead) roleCounts[d.role] = (roleCounts[d.role] || 0) + 1;
    }
    const topRole = Object.entries(roleCounts).sort((a, b) => b[1] - a[1])[0];
    const dir = CockpitHUD._SECTOR_DIRS[hotIdx] || '';
    advisory.innerHTML = `<span class="cf-warn">⚠ ${dir}</span><br>
      <span class="cf-dim">${topRole ? topRole[0].toUpperCase() : ''} ×${total}</span>`;
  }

  // ── Sonar + EMP resource pips ────────────────────────────────────────────

  _updateResources(g) {
    const sonarEl = document.getElementById('cf-sonar-pips');
    const empEl   = document.getElementById('cf-emp-pips');
    if (sonarEl) {
      const charges = g._sonarCharges ?? 0;
      const max     = 3;
      sonarEl.innerHTML = Array.from({ length: max }, (_, i) =>
        `<span class="cf-pip${i < charges ? ' cf-pip-on' : ''}" title="${i < charges ? 'متاح' : 'مستهلك'}"></span>`
      ).join('');
    }
    if (empEl) {
      const charges = g._empCharges ?? 0;
      const max     = Math.max(charges, 3);   // expand if player has bonus charges
      empEl.innerHTML = Array.from({ length: max }, (_, i) =>
        `<span class="cf-pip cf-pip-emp${i < charges ? ' cf-pip-on' : ''}" title="${i < charges ? 'متاح' : 'مستهلك'}"></span>`
      ).join('');
    }
  }

  // ── Placement mode bar ──────────────────────────────────────────────────

  _updatePlacementBar(g) {
    const bar = document.getElementById('cf-placement-bar');
    if (!bar) return;
    const empActive   = g._empMode   ?? false;
    const towerActive = g._towerMode ?? false;
    const active = empActive || towerActive;
    bar.classList.toggle('hidden', !active);
    if (!active) return;

    if (empActive) {
      bar.dataset.mode = 'emp';
      _set('cf-pb-icon',    '⚡');
      _set('cf-pb-text',    'انقر لوضع فخ EMP — يُصعق الأعداء في نطاق 80px');
      _set('cf-pb-charges', `متبقي: ${g._empCharges ?? 0}`);
    } else {
      bar.dataset.mode = 'tower';
      _set('cf-pb-icon',    '🏗');
      _set('cf-pb-text',    'انقر لبناء برج Gatling');
      _set('cf-pb-charges', `متبقي: ${3 - (g._towers?.length ?? 0)} مواضع`);
    }
  }

  // ── Commander HP in Threat Grid ──────────────────────────────────────────

  _updateCommanderHp(g) {
    const row    = document.getElementById('cf-cmd-hp-row');
    const fill   = document.getElementById('cf-cmd-hp-fill');
    const pctEl  = document.getElementById('cf-cmd-hp-pct');
    if (!row) return;

    const cmd = g.enemySwarm?.drones.find(d => !d.dead && d.role === 'commander');
    row.classList.toggle('hidden', !cmd);
    if (!cmd || !fill || !pctEl) return;

    const pct = Math.max(0, cmd.hp / (cmd.maxHp || 1));
    const pctPx = Math.round(pct * 100);
    fill.style.width = `${pctPx}%`;
    fill.style.background = pct > 0.6 ? '#ffaa00' : pct > 0.3 ? '#ff6600' : '#ff2200';
    pctEl.textContent = `${pctPx}%`;
  }

  // ── Commander danger banner ──────────────────────────────────────────────

  _updateCommanderDanger(g) {
    const el = document.getElementById('cf-cmd-danger');
    if (!el) return;
    const cmdAlive = g.enemySwarm?.drones.some(d => !d.dead && d.role === 'commander') ?? false;
    el.classList.toggle('hidden', !cmdAlive);
  }

  // ── Footer ───────────────────────────────────────────────────────────────

  _updateFooter(g) {
    _set('cf-kills',  `⬡ ${g.totalKills}`);
    _set('cf-losses', `✗ ${g.totalLosses}`);
    _set('cf-score',  `${g.score} pts`);

    const FORM_LABELS = {
      watch: 'وتش  WATCH', dagger: 'خنجر DAGGER',
      shield: 'درع  SHIELD', net: 'شبكة NET', point: 'نقطة POINT',
    };
    const f = g.playerSwarm?.currentFormation ?? 'watch';
    _set('cf-formation', FORM_LABELS[f] ?? f.toUpperCase());

    // Tick formation hint fade
    if ((this._formHintTimer ?? 0) > 0) {
      this._formHintTimer -= 0.12;   // matches throttle interval
      const hintEl = document.getElementById('cf-formation-hint');
      if (hintEl) {
        const alpha = Math.min(1, this._formHintTimer / 0.5);
        hintEl.style.opacity = alpha;
        if (this._formHintTimer <= 0) hintEl.textContent = '';
      }
    }
  }

  // ── Formation SVG preview ─────────────────────────────────────────────────

  _updateFormationPreview(g) {
    const svg = document.getElementById('cf-formation-svg');
    if (!svg) return;

    const name = g.playerSwarm?.currentFormation ?? 'watch';
    // Only redraw when formation changes
    if (this._lastPreviewFormation === name) return;
    this._lastPreviewFormation = name;

    const fn = FORMATIONS[name];
    if (!fn) { svg.innerHTML = ''; return; }

    // SVG canvas: 80×60 viewBox, center at (40, 30)
    const W = 80, H = 60, cx = W / 2, cy = H / 2;
    const N = 12;   // fixed dot count for preview
    const pts = fn(N, cx, cy);

    // Find bounding box to auto-scale into the viewBox
    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
    for (const p of pts) {
      minX = Math.min(minX, p.x); maxX = Math.max(maxX, p.x);
      minY = Math.min(minY, p.y); maxY = Math.max(maxY, p.y);
    }
    const rangeX = Math.max(maxX - minX, 1);
    const rangeY = Math.max(maxY - minY, 1);
    const pad = 8;
    const scaleX = (W - pad * 2) / rangeX;
    const scaleY = (H - pad * 2) / rangeY;
    const scale  = Math.min(scaleX, scaleY, 2.2);   // cap so dots don't overdraw

    const toSvg = (p) => ({
      x: pad + (p.x - minX) * scale + (W - pad * 2 - rangeX * scale) / 2,
      y: pad + (p.y - minY) * scale + (H - pad * 2 - rangeY * scale) / 2,
    });

    const accentColor = FORMATION_BOIDS[name] ? '#00e87a' : '#00ccff';
    const t = Date.now() / 1000;

    // Draw faint hull outline connecting outer points
    const hull = [...pts].sort((a, b) => Math.atan2(a.y - cy, a.x - cx) - Math.atan2(b.y - cy, b.x - cx));
    const hullSvg = hull.map((p, i) => {
      const sp = toSvg(p);
      return `${i === 0 ? 'M' : 'L'} ${sp.x.toFixed(1)} ${sp.y.toFixed(1)}`;
    }).join(' ') + ' Z';

    let html = `
      <defs>
        <filter id="fpgw" x="-80%" y="-80%" width="260%" height="260%">
          <feGaussianBlur in="SourceGraphic" stdDeviation="1.2" result="b"/>
          <feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge>
        </filter>
      </defs>
      <path d="${hullSvg}" fill="${accentColor}" fill-opacity="0.05"
            stroke="${accentColor}" stroke-opacity="0.18" stroke-width="0.8"
            stroke-dasharray="2,2"/>`;

    // Draw dots for each drone position
    for (let i = 0; i < pts.length; i++) {
      const sp = toSvg(pts[i]);
      // Slight stagger in opacity based on index
      const op = 0.55 + 0.35 * Math.sin(t * 1.8 + i * 0.55);
      html += `<circle cx="${sp.x.toFixed(1)}" cy="${sp.y.toFixed(1)}" r="2.4"
        fill="${accentColor}" opacity="${op.toFixed(2)}" filter="url(#fpgw)"/>`;
    }

    // Center crosshair (target point)
    const cc = toSvg({ x: cx, y: cy });
    html += `
      <line x1="${(cc.x-4).toFixed(1)}" y1="${cc.y.toFixed(1)}"
            x2="${(cc.x+4).toFixed(1)}" y2="${cc.y.toFixed(1)}"
            stroke="${accentColor}" stroke-width="0.7" opacity="0.30"/>
      <line x1="${cc.x.toFixed(1)}" y1="${(cc.y-4).toFixed(1)}"
            x2="${cc.x.toFixed(1)}" y2="${(cc.y+4).toFixed(1)}"
            stroke="${accentColor}" stroke-width="0.7" opacity="0.30"/>`;

    svg.innerHTML = html;
  }

  /** Show the formation hint text for 2 seconds. */
  showFormationHint(hint) {
    const hintEl = document.getElementById('cf-formation-hint');
    if (!hintEl) return;
    hintEl.textContent = hint;
    hintEl.style.opacity = 1;
    this._formHintTimer = 2.0;
  }

  // ── Radar label ──────────────────────────────────────────────────────────

  _updateRadarLabel(g) {
    const callsign = g._playerIdentity?.callsign || 'IRONHAWK';
    _set('cf-rl-squad', callsign);
    // Derive grid sector from radar sweep angle
    const angle   = g.radarSweep?.angle ?? 0;
    const sectors = ['H-7','K-8','M-9','R-6','S-7','H-8','K-7','M-6'];
    const idx     = Math.floor(((angle % (Math.PI * 2)) / (Math.PI * 2)) * sectors.length);
    _set('cf-rl-grid', `GRID: ${sectors[Math.max(0, idx % sectors.length)]}`);
  }
}

// ── Helpers ────────────────────────────────────────────────────────────────

function _set(id, text) {
  const el = document.getElementById(id);
  if (el && el.textContent !== text) el.textContent = text;
}
