/**
 * CockpitHUD — DOM overlay giving the game a military commander interface.
 *
 * Adds:
 *  • Slim top-bar    — callsign / wave / mission / clock
 *  • Corner brackets — four tactical corner markers
 *  • Right panel     — objectives status, squadron, threat grid
 *
 * All elements use pointer-events:none so the canvas remains fully interactive.
 */
export class CockpitHUD {

  /** @param {import('../core/Game.js').Game} game */
  constructor(game) {
    this.game      = game;
    this._born     = Date.now();
    this._throttle = 0;   // only refresh DOM every ~120ms (not every frame)
    this._inject();
  }

  // ── DOM construction ────────────────────────────────────────────────────

  _inject() {
    const root = document.getElementById('game-container');

    // ── Cockpit frame (top bar + corner brackets) ──────────────────────────
    const frame = document.createElement('div');
    frame.id = 'cf-frame';
    frame.innerHTML = `
      <div id="cf-topbar">
        <span id="cf-callsign" class="cf-dim">VULTURE-CMD</span>
        <span class="cf-sep">|</span>
        <span id="cf-wave">WAVE 1</span>
        <span class="cf-sep">|</span>
        <span id="cf-mission" class="cf-mission">DEFEND CITY GRID</span>
        <span class="cf-spacer"></span>
        <span id="cf-time" class="cf-dim">00:00</span>
      </div>
      <div class="cf-corner cf-tl"></div>
      <div class="cf-corner cf-tr"></div>
      <div class="cf-corner cf-bl"></div>
      <div class="cf-corner cf-br"></div>
    `;
    root.appendChild(frame);

    // ── Right command panel ────────────────────────────────────────────────
    const panel = document.createElement('div');
    panel.id = 'cf-panel';
    panel.innerHTML = `
      <div class="cf-panel-header">▣ CMD INTEL</div>

      <div class="cf-section">
        <div class="cf-section-label">OBJECTIVES</div>
        <div id="cf-objectives"></div>
      </div>

      <div class="cf-section">
        <div class="cf-section-label">SQUADRON</div>
        <div id="cf-squadron"></div>
      </div>

      <div class="cf-section">
        <div class="cf-section-label">THREAT GRID</div>
        <div class="cf-threat-row">
          <div id="cf-sectors">
            <div class="cf-grid">
              ${[0,1,2,3,4,5,6,7,8].map(i =>
                i === 4
                  ? `<div class="cf-cell cf-cell-cmd" id="cc-4">CMD</div>`
                  : `<div class="cf-cell" id="cc-${i}"></div>`
              ).join('')}
            </div>
          </div>
          <div id="cf-advisory"></div>
        </div>
      </div>

      <div class="cf-section cf-section-footer">
        <span id="cf-kills"  class="cf-green">⬡ 0</span>
        <span id="cf-losses" class="cf-red">✗ 0</span>
        <span id="cf-score"  class="cf-dim">0 pts</span>
      </div>
    `;
    root.appendChild(panel);
  }

  // ── Public API ──────────────────────────────────────────────────────────

  /** Call once per game frame (throttled internally to ~120 ms). */
  update(dt) {
    this._throttle -= dt;
    if (this._throttle > 0) return;
    this._throttle = 0.12;

    const g = this.game;

    this._updateTopBar(g);
    this._updateObjectives(g);
    this._updateSquadron(g);
    this._updateThreat(g);
    this._updateFooter(g);
  }

  /** Reset clock on game restart. */
  reset() { this._born = Date.now(); }

  // ── Top bar ─────────────────────────────────────────────────────────────

  _updateTopBar(g) {
    const sec  = Math.floor((Date.now() - this._born) / 1000);
    const mm   = String(Math.floor(sec / 60)).padStart(2, '0');
    const ss   = String(sec % 60).padStart(2, '0');
    const boss = g.wave % 5 === 0 && g.wave > 0;

    _set('cf-callsign', g._playerIdentity?.callsign || 'VULTURE-CMD');
    _set('cf-wave',     `WAVE ${g.wave}`);
    _set('cf-time',     `${mm}:${ss}`);

    const missionEl = document.getElementById('cf-mission');
    if (missionEl) {
      missionEl.textContent = boss ? '⚠ BOSS WAVE — HIGH THREAT' : 'DEFEND CITY GRID';
      missionEl.style.color = boss ? '#ff6633' : '#00e87a';
    }
  }

  // ── Objectives ──────────────────────────────────────────────────────────

  _updateObjectives(g) {
    const el = document.getElementById('cf-objectives');
    if (!el) return;

    el.innerHTML = g.objectives.map(obj => {
      const pct    = obj.health <= 0 ? 0 : obj.health / obj.maxHealth;
      const color  = pct > 0.6 ? '#00e87a' : pct > 0.3 ? '#ffaa00' : '#ff3333';
      const label  = (obj._label ?? obj._type ?? '??').toUpperCase();
      const status = obj.health <= 0 ? 'DESTROYED' : pct <= 0.3 ? 'CRITICAL' : `${Math.floor(pct * 100)}%`;
      return `
        <div class="cf-obj-row">
          <span class="cf-obj-label" style="color:${color}">${label}</span>
          <div class="cf-bar-track">
            <div class="cf-bar-fill" style="width:${Math.floor(pct*100)}%;background:${color}"></div>
          </div>
          <span class="cf-obj-pct" style="color:${color}">${status}</span>
        </div>`;
    }).join('');
  }

  // ── Squadron ─────────────────────────────────────────────────────────────

  _updateSquadron(g) {
    const el = document.getElementById('cf-squadron');
    if (!el) return;

    const all    = g.playerSwarm.drones;
    const alive  = all.filter(d => !d.dead);
    const kia    = all.filter(d =>  d.dead).length;
    const gA     = alive.filter(d => d._group !== 'B');
    const gB     = alive.filter(d => d._group === 'B');
    const form   = (g.playerSwarm.currentFormation ?? 'circle').toUpperCase();

    const avgHp  = arr => arr.length === 0 ? 0
      : arr.reduce((s, d) => s + (d.hp / (d.maxHp || 1)), 0) / arr.length;

    const hpColor = p => p > 0.6 ? '#00e87a' : p > 0.3 ? '#ffaa00' : '#ff3333';

    let html = '';

    if (gA.length > 0) {
      const hp = avgHp(gA);
      html += `<div class="cf-unit-row">
        <span class="cf-unit-id cf-green">▶ ALPHA</span>
        <span class="cf-unit-cnt">×${gA.length}</span>
        <span class="cf-unit-hp" style="color:${hpColor(hp)}">${Math.floor(hp*100)}%</span>
        <span class="cf-unit-form">${form}</span>
      </div>`;
    }

    if (gB.length > 0) {
      const hp = avgHp(gB);
      html += `<div class="cf-unit-row">
        <span class="cf-unit-id" style="color:#00aa55">▶ BRAVO</span>
        <span class="cf-unit-cnt">×${gB.length}</span>
        <span class="cf-unit-hp" style="color:${hpColor(hp)}">${Math.floor(hp*100)}%</span>
      </div>`;
    }

    if (kia > 0) {
      html += `<div class="cf-unit-row cf-red">✗ KIA  ×${kia}</div>`;
    }

    if (html === '') {
      html = '<div class="cf-unit-row cf-dim">NO ACTIVE UNITS</div>';
    }

    el.innerHTML = html;
  }

  // ── Threat grid ──────────────────────────────────────────────────────────

  // Sector indices match a 3×3 grid:
  //  0  1  2     NW  N  NE
  //  3  4  5  =   W  .   E
  //  6  7  8     SW  S  SE
  static _SECTOR_NAMES = ['NW','N','NE','W','','E','SW','S','SE'];
  static _SECTOR_DIRS  = ['NW','NORTH','NE','WEST','','EAST','SW','SOUTH','SE'];

  _updateThreat(g) {
    const W  = g.canvas.width;
    const H  = g.canvas.height;
    const cx = W / 2;
    const cy = H / 2;

    // Count enemies per sector
    const counts = new Array(9).fill(0);
    for (const d of g.enemySwarm.drones) {
      if (d.dead) continue;
      const col = Math.max(0, Math.min(2, Math.round((d.x - cx) / (cx * 0.9) + 1)));
      const row = Math.max(0, Math.min(2, Math.round((d.y - cy) / (cy * 0.9) + 1)));
      const si  = row * 3 + col;
      if (si !== 4) counts[si]++;
    }

    // Update cells
    const names = CockpitHUD._SECTOR_NAMES;
    for (let i = 0; i < 9; i++) {
      if (i === 4) continue;
      const cell = document.getElementById(`cc-${i}`);
      if (!cell) continue;
      if (counts[i] > 0) {
        cell.textContent = counts[i];
        cell.className   = 'cf-cell cf-cell-hot';
      } else {
        cell.textContent = names[i];
        cell.className   = 'cf-cell';
      }
    }

    // Advisory text
    const advisory = document.getElementById('cf-advisory');
    if (!advisory) return;

    const total = g.enemySwarm.drones.filter(d => !d.dead).length;

    if (total === 0) {
      advisory.innerHTML = '<span class="cf-green">SECTOR CLEAR</span>';
      return;
    }

    // Hottest sector
    let hotIdx = -1, hotVal = 0;
    for (let i = 0; i < 9; i++) {
      if (i !== 4 && counts[i] > hotVal) { hotVal = counts[i]; hotIdx = i; }
    }

    // Dominant role
    const roleCounts = {};
    for (const d of g.enemySwarm.drones) {
      if (!d.dead) roleCounts[d.role] = (roleCounts[d.role] || 0) + 1;
    }
    const topRole = Object.entries(roleCounts).sort((a, b) => b[1] - a[1])[0];
    const dir     = hotIdx >= 0 ? CockpitHUD._SECTOR_DIRS[hotIdx] : '';

    advisory.innerHTML = `
      <span class="cf-warn">⚠ ${dir}</span><br>
      <span class="cf-dim">${topRole ? topRole[0].toUpperCase() : ''} ×${total}</span>
    `;
  }

  // ── Footer ───────────────────────────────────────────────────────────────

  _updateFooter(g) {
    _set('cf-kills',  `⬡ ${g.totalKills}`);
    _set('cf-losses', `✗ ${g.totalLosses}`);
    _set('cf-score',  `${g.score} pts`);
  }
}

// ── Helpers ────────────────────────────────────────────────────────────────

function _set(id, text) {
  const el = document.getElementById(id);
  if (el && el.textContent !== text) el.textContent = text;
}
