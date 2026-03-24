import { Canvas } from './Canvas.js';
import { ParticleSystem } from './Particles.js';
import { ScreenShake } from './ScreenShake.js';
import { Audio } from './Audio.js';
import { SwarmController } from '../entities/SwarmController.js';
import { EnemySwarm } from '../entities/EnemySwarm.js';
import { Objective } from '../entities/Objective.js';
import { CityResources } from '../entities/CityResources.js';
import { generateHazards } from '../entities/HazardZone.js';
import { DataCollector } from '../data/DataCollector.js';
import { Commander } from '../ui/Commander.js';
import { HUD } from '../ui/HUD.js';
import { WaveAnnouncer } from '../ui/WaveAnnouncer.js';
import { GameOverScreen } from '../ui/GameOverScreen.js';
import { Agent } from '../ai/Agent.js';
import { UpgradeScreen } from '../ui/UpgradeScreen.js';
import { StartScreen } from '../ui/StartScreen.js';
import { MissionSetupScreen } from '../ui/MissionSetupScreen.js';
import { TARGET_TYPES } from '../entities/TargetTypes.js';
import { getWaveStory } from '../data/StoryLines.js';
import { RadarSweep } from './RadarSweep.js';

export class Game {
  constructor() {
    this.canvas = new Canvas('game-container');
    this.ctx = this.canvas.ctx;

    this.particles = new ParticleSystem();
    this.shake = new ScreenShake();
    this.audio = new Audio();

    // ── 3 fixed city objectives ───────────────────────────────────────────────
    this.objectives    = this._buildObjectives();
    this.cityResources = new CityResources();

    this.hazards = [];

    this.playerSwarm   = new SwarmController(20, this.canvas, 'friendly');
    this.enemySwarm    = new EnemySwarm(0, this.canvas, this.objectives);
    this.dataCollector = new DataCollector();
    this.hud           = new HUD(this.canvas);
    this.waveAnnouncer = new WaveAnnouncer();
    this.commander     = new Commander(this.canvas, this.playerSwarm, this.dataCollector, this);

    this.gameOverScreen = new GameOverScreen(() => this._restart());
    this.gameOverScreen.onExport(() => this.dataCollector.download());

    this.upgradeScreen = new UpgradeScreen();

    this.radarSweep = new RadarSweep();

    this.agent  = new Agent(this.playerSwarm, this);
    this.aiMode = false;
    this._awaitingUpgrade = false;

    this.score   = 0;
    this.wave    = 0;
    this.running = true;
    this._lastTime  = 0;
    this._waveDelay = 0;

    // ── Streak & stats ────────────────────────────────────────────────────────
    this._streak          = 0;   // consecutive perfect waves (no objective hit)
    this._maxStreak       = 0;
    this._perfectWave     = true; // set false when any objective takes damage
    this._bossWavesCleared = 0;

    // ── Tutorial hints ────────────────────────────────────────────────────────
    this._clickHintTimer = 4;

    // ── Mission state ─────────────────────────────────────────────────────────
    this._scoreMulti    = 1;
    this._missionApproach = null;
    this._defenseProfile  = null;

    // ── Alert banner ──────────────────────────────────────────────────────────
    this._alertText  = '';
    this._alertTimer = 0;

    // ── Combat tracking ───────────────────────────────────────────────────────
    this.waveKills   = 0;
    this.waveLosses  = 0;
    this.totalKills  = 0;
    this.totalLosses = 0;

    // ── Laser effects ─────────────────────────────────────────────────────────
    this._lasers = [];

    new StartScreen().show().then(() => this._runMissionSetup());
  }

  _buildObjectives() {
    const W = this.canvas.width;
    const H = this.canvas.height;
    return [
      new Objective(W * 0.50, H * 0.16, 'power'),  // ⚡ top-center
      new Objective(W * 0.18, H * 0.68, 'water'),  // 💧 left
      new Objective(W * 0.82, H * 0.68, 'food'),   // 🌾 right
    ];
  }

  start() {
    requestAnimationFrame((t) => this._loop(t));
  }

  _restart() {
    this.objectives = this._buildObjectives();
    this.enemySwarm.objectives = this.objectives;
    this.cityResources.reset();
    this.hazards      = [];
    this.score        = 0;
    this.wave         = 0;
    this._streak           = 0;
    this._maxStreak        = 0;
    this._perfectWave      = true;
    this._bossWavesCleared = 0;
    this.waveKills   = 0;
    this.waveLosses  = 0;
    this.totalKills  = 0;
    this.totalLosses = 0;
    this._lasers     = [];
    this._alertText  = '';
    this._alertTimer = 0;
    this._clickHintTimer = 4;
    this.particles.particles.length = 0;
    this.playerSwarm.drones.length  = 0;
    this.enemySwarm.drones.length   = 0;
    this.running = true;
    this._runMissionSetup();
  }

  _runMissionSetup() {
    new MissionSetupScreen().show().then((setup) => {
      this._scoreMulti  = TARGET_TYPES[setup.targetId]?.scoreMulti ?? 1;
      this._scoreMulti *= (1 + (setup.defenseProfile.surpriseBonus ?? 0));

      this.playerSwarm.drones.length = 0;
      for (const [role, count] of Object.entries(setup.loadout)) {
        if (count > 0) this.playerSwarm.reinforce(count, role);
      }
      if (this.playerSwarm.drones.length === 0) {
        this.playerSwarm.reinforce(10, 'standard');
      }

      this.enemySwarm.defenseProfile = setup.defenseProfile;
      this._missionApproach = setup.approach;
      this._defenseProfile  = setup.defenseProfile;
      this._clickHintTimer  = 4;
      this._nextWave();
    });
  }

  _nextWave() {
    this.wave++;
    this._waveDelay   = 1.5;
    this.waveKills    = 0;
    this.waveLosses   = 0;
    this._perfectWave = true;   // assume perfect until an objective is hit

    this.hazards = generateHazards(
      this.wave, this.canvas.width, this.canvas.height,
      this.objectives
    );

    const isBossWave = this.wave % 5 === 0;
    const story = getWaveStory(this.wave, isBossWave, this.cityResources, this._streak);
    this.waveAnnouncer.announce(this.wave, isBossWave, story, this._streak);
    this.audio.waveStart();
    this.enemySwarm.spawnWave(this.wave);
    if (this.wave > 1 && this.playerSwarm.drones.length < 20) {
      this.playerSwarm.reinforce(Math.min(5, 20 - this.playerSwarm.drones.length), 'standard');
    }
  }

  _loop(timestamp) {
    if (!this.running) return;
    const dt = Math.min((timestamp - this._lastTime) / 1000, 0.05);
    this._lastTime = timestamp;
    this._update(dt);
    this._draw();
    requestAnimationFrame((t) => this._loop(t));
  }

  toggleAI() {
    this.aiMode = !this.aiMode;
    if (this.aiMode && !this.agent.active) this.agent.load();
  }

  _update(dt) {
    if (this._waveDelay > 0)     this._waveDelay   -= dt;
    if (this._clickHintTimer > 0) this._clickHintTimer -= dt;
    if (this._alertTimer > 0)    this._alertTimer   -= dt;
    if (this.aiMode) this.agent.update(dt);

    this._lasers = this._lasers.filter(l => (l.ttl -= dt) > 0);

    this.cityResources.syncFromObjectives(this.objectives);
    this.cityResources.update(dt, this.playerSwarm, this.objectives);

    // Food speed penalty
    const speedMod = this.cityResources.speedModifier();
    if (speedMod < 1.0) {
      for (const d of this.playerSwarm.drones) {
        if (!d._baseMaxSpeed) d._baseMaxSpeed = d.maxSpeed;
        d.maxSpeed = Math.round(d._baseMaxSpeed * speedMod);
      }
    }

    this.playerSwarm.update(dt, this.enemySwarm.drones);
    this.enemySwarm.update(dt, this.playerSwarm.drones);
    this.particles.update(dt);
    this.shake.update(dt);
    this.waveAnnouncer.update(dt);

    // ── Radar sweep ───────────────────────────────────────────────────
    const cx = this.canvas.width / 2, cy = this.canvas.height / 2;
    const allEntities = [...this.playerSwarm.drones, ...this.enemySwarm.drones];
    this.radarSweep.update(dt, cx, cy, allEntities);

    // ── Objective threat state (drives spinning danger ring) ──────────
    const THREAT_R2 = 200 * 200;
    for (const obj of this.objectives) {
      obj._threatened = this.enemySwarm.drones.some(e => {
        const dx = e.x - obj.x, dy = e.y - obj.y;
        return dx * dx + dy * dy < THREAT_R2;
      });
    }

    this._applyHazards(dt);
    this._applyAutoRecovery(dt);
    this._checkCombat(dt);
    this._checkObjectiveHits();
    this._checkWaveComplete();
    this._checkGameOver();
  }

  // ── Recovery ───────────────────────────────────────────────────────────────

  /** Objectives slowly heal when no enemy is within SAFE_RADIUS. */
  _applyAutoRecovery(dt) {
    const SAFE_R2      = 220 * 220;
    const RECOVERY_RATE = 0.45;   // HP/s

    for (const obj of this.objectives) {
      if (obj.health <= 0 || obj.health >= obj.maxHealth) continue;
      const threatened = this.enemySwarm.drones.some(e => {
        const dx = e.x - obj.x, dy = e.y - obj.y;
        return dx * dx + dy * dy < SAFE_R2;
      });
      if (!threatened) {
        obj.health = Math.min(obj.maxHealth, obj.health + RECOVERY_RATE * dt);
      }
    }
  }

  // ── Hazards ────────────────────────────────────────────────────────────────

  _applyHazards(dt) {
    if (!this.hazards.length) return;
    const dpsMulti = this.cityResources.hazardDpsMultiplier();
    const all = [...this.playerSwarm.drones, ...this.enemySwarm.drones];
    for (const h of this.hazards) h.applyDamage(all, dt, dpsMulti);
    this.playerSwarm.drones = this.playerSwarm.drones.filter(d => !d.dead);
    this.enemySwarm.drones  = this.enemySwarm.drones.filter(d => !d.dead);
  }

  // ── Combat ─────────────────────────────────────────────────────────────────

  _checkCombat(dt) {
    const friendly = this.playerSwarm.drones;
    const enemies  = this.enemySwarm.drones;

    for (const p of friendly) {
      const target = p.findTarget(enemies);
      if (!target) continue;
      if (!p.tickFire(dt)) continue;
      this._lasers.push({ x1: p.x, y1: p.y, x2: target.x, y2: target.y,
                          color: '#00d4ff', ttl: 0.08 });
      if (target.takeDamage(p.fireDamage)) {
        this.particles.explode(target.x, target.y, '#ff3c3c', 10);
        this.audio.enemyDestroyed();
        this.score += Math.round(10 * this._scoreMulti);
        this.waveKills++;
        this.totalKills++;
      }
    }

    for (const e of enemies) {
      const target = e.findTarget(friendly);
      if (!target) continue;
      if (!e.tickFire(dt)) continue;
      this._lasers.push({ x1: e.x, y1: e.y, x2: target.x, y2: target.y,
                          color: '#ff3c3c', ttl: 0.08 });
      if (target.takeDamage(e.fireDamage)) {
        this.particles.explode(target.x, target.y, '#00d4ff', 6);
        this.waveLosses++;
        this.totalLosses++;
      }
    }

    this.playerSwarm.drones = friendly.filter(d => !d.dead);
    this.enemySwarm.drones  = enemies.filter(d => !d.dead);
  }

  _checkObjectiveHits() {
    const OBJ_R2  = 30 * 30;
    const enemies = this.enemySwarm.drones;

    for (let j = enemies.length - 1; j >= 0; j--) {
      const e = enemies[j];
      for (const obj of this.objectives) {
        if (obj.health <= 0) continue;
        const dx = e.x - obj.x, dy = e.y - obj.y;
        if (dx * dx + dy * dy < OBJ_R2) {
          this.particles.explode(e.x, e.y, '#ff8800', 8);
          enemies.splice(j, 1);
          const prevPct = obj.health / obj.maxHealth;
          obj.health = Math.max(0, obj.health - 10);
          this.shake.trigger(10, 0.35);
          this.audio.objectiveHit();
          this._perfectWave = false;   // wave is no longer perfect

          if (obj.health <= 0 && prevPct > 0) {
            this._showAlert(`💥 ${obj._label} دُمِّرت!`);
          } else if (obj.health / obj.maxHealth <= 0.30 && prevPct > 0.30) {
            this._showAlert(`⚠ ${obj._label} في خطر شديد!`);
          }
          break;
        }
      }
    }
  }

  _showAlert(text) {
    this._alertText  = text;
    this._alertTimer = 3.0;
  }

  // ── Wave complete ──────────────────────────────────────────────────────────

  _checkWaveComplete() {
    if (this._waveDelay > 0) return;
    if (this._awaitingUpgrade) return;
    if (this.enemySwarm.drones.length > 0 || this.enemySwarm.spawning) return;

    // ── Wave-clear bonus: heal alive objectives ──────────────────────────────
    const HEAL_PER_WAVE = 8;
    for (const obj of this.objectives) {
      if (obj.health > 0) {
        obj.health = Math.min(obj.maxHealth, obj.health + HEAL_PER_WAVE);
      }
    }

    // ── Streak tracking ──────────────────────────────────────────────────────
    if (this._perfectWave) {
      this._streak++;
      if (this._streak > this._maxStreak) this._maxStreak = this._streak;
      if (this._streak >= 2) {
        this._showAlert(`🔥 سلسلة مثالية ×${this._streak}!`);
      }
    } else {
      this._streak = 0;
    }

    // Track boss waves cleared
    if (this.wave % 5 === 0) this._bossWavesCleared++;

    this.score += Math.round(100 * this.wave * this._scoreMulti);
    this._awaitingUpgrade = true;

    this.upgradeScreen
      .show(this.wave, { kills: this.waveKills, losses: this.waveLosses, score: this.score })
      .then((key) => {
        this._applyUpgrade(key);
        this._awaitingUpgrade = false;
        this._nextWave();
      });
  }

  _applyUpgrade(key) {
    const drones = this.playerSwarm.drones;
    switch (key) {
      case 'craft_interceptor': this.playerSwarm.reinforce(2, 'interceptor'); break;
      case 'craft_gunship':     this.playerSwarm.reinforce(2, 'gunship');     break;
      case 'craft_sentinel':    this.playerSwarm.reinforce(2, 'sentinel');    break;
      case 'drones':            this.playerSwarm.reinforce(5, 'standard');    break;
      case 'firepower':
        for (const d of drones) d.fireDamage = Math.round(d.fireDamage * 1.30);
        break;
      case 'speed':
        for (const d of drones) {
          d._baseMaxSpeed = Math.round((d._baseMaxSpeed ?? d.maxSpeed) * 1.20);
          d.maxSpeed = Math.round(d._baseMaxSpeed * this.cityResources.speedModifier());
        }
        break;
      case 'repair': {
        // Heal the most damaged alive objective by 30 HP
        const alive = this.objectives.filter(o => o.health > 0);
        if (alive.length) {
          const worst = alive.reduce((w, o) => o.health < w.health ? o : w, alive[0]);
          worst.health = Math.min(worst.maxHealth, worst.health + 30);
          this._showAlert(`🔧 تم إصلاح ${worst._label} (+30 HP)`);
        }
        break;
      }
      default: break;
    }
  }

  // ── Threat score ───────────────────────────────────────────────────────────

  threatScore() {
    const enemies = this.enemySwarm.drones;
    if (!enemies.length) return 0;
    const THREAT_R = 250;
    let near = 0;
    for (const e of enemies) {
      for (const obj of this.objectives) {
        const dx = e.x - obj.x, dy = e.y - obj.y;
        if (dx * dx + dy * dy < THREAT_R * THREAT_R) { near++; break; }
      }
    }
    return near / enemies.length;
  }

  // ── Game over ──────────────────────────────────────────────────────────────

  _checkGameOver() {
    if (!this.cityResources.cityFallen()) return;
    this.running = false;
    this.audio.gameOver();
    setTimeout(() => {
      this.gameOverScreen.show(this.score, this.wave, this.dataCollector.sampleCount, {
        objectivesAlive:   this.objectives.filter(o => o.health > 0).length,
        maxStreak:         this._maxStreak,
        bossWavesCleared:  this._bossWavesCleared,
        totalKills:        this.totalKills,
        totalLosses:       this.totalLosses,
        resources: {
          power: this.cityResources.power,
          water: this.cityResources.water,
          food:  this.cityResources.food,
        },
      });
    }, 600);
  }

  // ── Rendering ──────────────────────────────────────────────────────────────

  _draw() {
    const ctx = this.ctx;
    const W = this.canvas.width, H = this.canvas.height;

    // 1. Clear + radar background (fixed — not shaken)
    this.canvas.clear();
    this._drawRadarBackground();

    // 2. Game-world elements (screen-shake applied)
    ctx.save();
    this.shake.apply(ctx);

    this._drawCityConnections();
    for (const h of this.hazards) h.draw(ctx);
    for (const obj of this.objectives) obj.draw(ctx);
    this.commander.drawTargetZone(ctx);
    this._drawLasers();
    this.playerSwarm.draw(ctx);
    this.enemySwarm.draw(ctx);
    this.particles.draw(ctx);

    ctx.restore();

    // 3. Radar sweep overlay (fixed — not shaken)
    this.radarSweep.draw(ctx, W / 2, H / 2, W, H);

    // 4. UI
    this.waveAnnouncer.draw(ctx, W, H);
    this._drawAlertBanner();
    this._drawClickHint();
    this.hud.draw(
      this.score, this.wave,
      this.cityResources,
      this.playerSwarm.drones.length,
      this.playerSwarm.currentFormation,
      this.dataCollector.sampleCount,
      this.dataCollector.serverStatus,
      this.totalKills, this.totalLosses,
      this.hazards.length,
      this.wave % 5 === 0
    );
  }

  _drawCityConnections() {
    const ctx = this.ctx;
    ctx.save();
    ctx.strokeStyle = 'rgba(0,200,80,0.13)';
    ctx.lineWidth = 1;
    ctx.setLineDash([6, 14]);
    for (let i = 0; i < this.objectives.length; i++) {
      for (let j = i + 1; j < this.objectives.length; j++) {
        const a = this.objectives[i], b = this.objectives[j];
        ctx.beginPath();
        ctx.moveTo(a.x, a.y);
        ctx.lineTo(b.x, b.y);
        ctx.stroke();
      }
    }
    ctx.setLineDash([]);
    ctx.restore();
  }

  _drawAlertBanner() {
    if (this._alertTimer <= 0 || !this._alertText) return;
    const alpha = Math.min(1, this._alertTimer / 1.0);
    const ctx = this.ctx;
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.font = 'bold 20px monospace';
    ctx.textAlign = 'center';
    ctx.fillStyle = '#ff4444';
    ctx.shadowColor = '#ff0000';
    ctx.shadowBlur = 22;
    ctx.fillText(this._alertText, this.canvas.width / 2, this.canvas.height / 2 - 44);
    ctx.restore();
  }

  _drawLasers() {
    const ctx = this.ctx;
    ctx.save();
    for (const l of this._lasers) {
      const alpha = l.ttl / 0.08;
      ctx.strokeStyle = l.color.replace(')', `,${alpha * 0.9})`).replace('rgb', 'rgba');
      ctx.lineWidth = 1.5;
      ctx.shadowColor = l.color;
      ctx.shadowBlur = 6;
      ctx.beginPath();
      ctx.moveTo(l.x1, l.y1);
      ctx.lineTo(l.x2, l.y2);
      ctx.stroke();
    }
    ctx.restore();
  }

  _drawClickHint() {
    if (this._clickHintTimer <= 0) return;
    const alpha = Math.min(1, this._clickHintTimer / 1.5);
    const ctx = this.ctx;
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.font = 'bold 15px monospace';
    ctx.textAlign = 'center';
    ctx.fillStyle = '#00d4ff';
    ctx.shadowColor = '#00d4ff';
    ctx.shadowBlur = 12;
    ctx.fillText('🖱  انقر على الشاشة لتحريك الأسراب', this.canvas.width / 2, this.canvas.height - 80);
    ctx.restore();
  }

  /**
   * Radar background — concentric rings, crosshairs, bearing labels, scanlines.
   * Drawn BEFORE the shake transform so it stays fixed on screen.
   */
  _drawRadarBackground() {
    const ctx = this.ctx;
    const W = this.canvas.width, H = this.canvas.height;
    const cx = W / 2, cy = H / 2;
    const maxR = Math.sqrt(W * W + H * H) / 2;

    // CRT scanlines (horizontal, every 3 px)
    ctx.fillStyle = 'rgba(0,0,0,0.04)';
    for (let y = 0; y < H; y += 3) ctx.fillRect(0, y, W, 1);

    // Concentric rings
    ctx.strokeStyle = 'rgba(0,200,80,0.13)';
    ctx.lineWidth   = 1;
    for (const frac of [0.22, 0.44, 0.66, 0.88]) {
      ctx.beginPath();
      ctx.arc(cx, cy, maxR * frac, 0, Math.PI * 2);
      ctx.stroke();
    }

    // Crosshairs (dashed)
    ctx.strokeStyle = 'rgba(0,200,80,0.10)';
    ctx.setLineDash([8, 18]);
    ctx.beginPath(); ctx.moveTo(cx, 0);    ctx.lineTo(cx, H); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(0,  cy);   ctx.lineTo(W, cy); ctx.stroke();
    ctx.setLineDash([]);

    // 45° diagonal lines (very faint)
    ctx.strokeStyle = 'rgba(0,200,80,0.05)';
    const d = maxR * 1.5;
    ctx.beginPath(); ctx.moveTo(cx - d, cy - d); ctx.lineTo(cx + d, cy + d); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(cx + d, cy - d); ctx.lineTo(cx - d, cy + d); ctx.stroke();

    // Tick marks on rings (single path for perf)
    ctx.strokeStyle = 'rgba(0,200,80,0.22)';
    ctx.lineWidth   = 1;
    ctx.beginPath();
    for (const frac of [0.22, 0.44, 0.66, 0.88]) {
      const r = maxR * frac;
      for (let deg = 0; deg < 360; deg += 10) {
        const a    = (deg * Math.PI) / 180;
        const tick = deg % 30 === 0 ? 5 : 2.5;
        ctx.moveTo(cx + Math.cos(a) * (r - tick), cy + Math.sin(a) * (r - tick));
        ctx.lineTo(cx + Math.cos(a) * (r + tick), cy + Math.sin(a) * (r + tick));
      }
    }
    ctx.stroke();

    // Bearing labels
    const labelR   = maxR * 0.93;
    const bearings = [
      { a: -Math.PI / 2,      label: 'N',   bold: true },
      { a:  0,                label: 'E',   bold: true },
      { a:  Math.PI / 2,      label: 'S',   bold: true },
      { a:  Math.PI,          label: 'W',   bold: true },
      { a: -Math.PI * 3 / 4,  label: '315' },
      { a: -Math.PI / 4,      label: '045' },
      { a:  Math.PI / 4,      label: '135' },
      { a:  Math.PI * 3 / 4,  label: '225' },
    ];
    ctx.textAlign    = 'center';
    ctx.textBaseline = 'middle';
    for (const b of bearings) {
      ctx.font      = b.bold ? 'bold 11px monospace' : '9px monospace';
      ctx.fillStyle = b.bold ? 'rgba(0,220,90,0.60)' : 'rgba(0,200,80,0.30)';
      ctx.fillText(b.label,
        cx + Math.cos(b.a) * labelR,
        cy + Math.sin(b.a) * labelR
      );
    }

    // Centre dot
    ctx.fillStyle   = 'rgba(0,255,100,0.45)';
    ctx.shadowColor = '#00ff88';
    ctx.shadowBlur  = 10;
    ctx.beginPath();
    ctx.arc(cx, cy, 2.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;
  }
}
