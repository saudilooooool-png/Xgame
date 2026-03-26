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
    this._inject();
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

    // ── 2. Right command panel ─────────────────────────────────────────────
    const panel = document.createElement('div');
    panel.id = 'cf-panel';
    panel.innerHTML = `
      <div class="cf-panel-header">▣ CMD INTEL</div>

      <div class="cf-section">
        <div class="cf-section-label">OBJECTIVES</div>
        <div id="cf-objectives"></div>
      </div>

      <div class="cf-section">
        <div class="cf-section-label">COMMAND WEB</div>
        <svg id="cf-web" viewBox="0 0 238 130"
             xmlns="http://www.w3.org/2000/svg"></svg>
      </div>

      <div class="cf-section">
        <div class="cf-section-label">THREAT GRID</div>
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
      </div>

      <div class="cf-section cf-section-footer">
        <span id="cf-kills"  class="cf-green">⬡ 0</span>
        <span id="cf-losses" class="cf-red">✗ 0</span>
        <span id="cf-score"  class="cf-dim">0 pts</span>
      </div>
    `;
    root.appendChild(panel);

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
      <span>Spatial Radar</span>
      <span class="cf-rl-sep">|</span>
      <span id="cf-rl-grid">GRID: H-7</span>
    `;

    radarWrap.appendChild(radarCv);
    radarWrap.appendChild(radarLabel);
    root.appendChild(radarWrap);

    this.radarCanvas = radarCv;
  }

  // ── Public API ──────────────────────────────────────────────────────────

  /** Call every frame (throttled internally). */
  update(dt) {
    this._throttle -= dt;
    if (this._throttle > 0) return;
    this._throttle = 0.12;

    const g = this.game;
    this._updateTopBar(g);
    this._updateObjectives(g);
    this._updateCommandWeb(g);
    this._updateThreat(g);
    this._updateFooter(g);
    this._updateRadarLabel(g);
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

  reset() { this._born = Date.now(); }

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
    el.innerHTML = g.objectives.map(obj => {
      const pct   = obj.health <= 0 ? 0 : obj.health / obj.maxHealth;
      const color = pct > 0.6 ? '#00e87a' : pct > 0.3 ? '#ffaa00' : '#ff3333';
      const label = (obj._label ?? obj._type ?? '??').toUpperCase();
      const txt   = obj.health <= 0 ? 'DESTROYED' : pct <= 0.3 ? 'CRITICAL' : `${Math.floor(pct * 100)}%`;
      return `<div class="cf-obj-row">
        <span class="cf-obj-label" style="color:${color}">${label}</span>
        <div class="cf-bar-track">
          <div class="cf-bar-fill" style="width:${Math.floor(pct*100)}%;background:${color}"></div>
        </div>
        <span class="cf-obj-pct" style="color:${color}">${txt}</span>
      </div>`;
    }).join('');
  }

  // ── Command Web ──────────────────────────────────────────────────────────

  _updateCommandWeb(g) {
    const svg = document.getElementById('cf-web');
    if (!svg) return;

    const objs  = g.objectives;
    const all   = g.playerSwarm.drones;
    const gA    = all.filter(d => !d.dead && d._group !== 'B');
    const gB    = all.filter(d => !d.dead && d._group === 'B');
    const kia   = all.filter(d => d.dead).length;
    const avgHp = arr => arr.length === 0 ? 0
      : arr.reduce((s, d) => s + d.hp / (d.maxHp || 1), 0) / arr.length;
    const hpColor = p => p > 0.6 ? '#00e87a' : p > 0.3 ? '#ffaa00' : '#ff3333';
    const form  = (g.playerSwarm.currentFormation ?? 'circle').toUpperCase();

    // Fixed positions: objective nodes top, group nodes bottom
    const OBJ_POS = [
      { x: 40,  y: 22 },
      { x: 119, y: 22 },
      { x: 198, y: 22 },
    ];
    const grpData = [];
    if (gA.length > 0)
      grpData.push({ x: gB.length > 0 ? 74 : 119, y: 94, label: 'ALPHA', drones: gA, hp: avgHp(gA), form });
    if (gB.length > 0)
      grpData.push({ x: gA.length > 0 ? 164 : 119, y: 94, label: 'BRAVO', drones: gB, hp: avgHp(gB), form: '' });

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
        const lc  = hot ? 'rgba(255,100,0,0.30)' : 'rgba(0,210,100,0.18)';
        html += `<line x1="${grp.x}" y1="${grp.y - 11}"
                       x2="${op.x}"  y2="${op.y + 8}"
                       stroke="${lc}" stroke-width="0.8" stroke-dasharray="3,5"/>`;
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

    // Group nodes — aircraft chevron shape
    for (const grp of grpData) {
      const cx  = grp.x, cy = grp.y;
      const col = hpColor(grp.hp);
      html += `
        <polygon points="${cx},${cy-11} ${cx-7},${cy+3} ${cx},${cy} ${cx+7},${cy+3}"
          fill="${col}" opacity="0.82" filter="url(#gw)"/>
        <text x="${cx}" y="${cy + 18}" text-anchor="middle"
          font-size="7" fill="${col}" font-family="monospace"
          font-weight="bold">${grp.label}</text>
        <text x="${cx}" y="${cy + 27}" text-anchor="middle"
          font-size="7" fill="${col}" font-family="monospace"
          opacity="0.75">×${grp.drones.length} ${Math.floor(grp.hp * 100)}%</text>`;
      if (grp.form) {
        html += `<text x="${cx}" y="${cy + 36}" text-anchor="middle"
          font-size="6" fill="rgba(0,200,80,0.40)" font-family="monospace">${grp.form}</text>`;
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

  // ── Footer ───────────────────────────────────────────────────────────────

  _updateFooter(g) {
    _set('cf-kills',  `⬡ ${g.totalKills}`);
    _set('cf-losses', `✗ ${g.totalLosses}`);
    _set('cf-score',  `${g.score} pts`);
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
