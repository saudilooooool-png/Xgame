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

export class Game {
  constructor() {
    this.canvas = new Canvas('game-container');
    this.ctx = this.canvas.ctx;

    this.particles = new ParticleSystem();
    this.shake = new ScreenShake();
    this.audio = new Audio();

    // ── 3 fixed city objectives (power ⚡, water 💧, food 🌾) ─────────────────
    this.objectives = this._buildObjectives();
    this.cityResources = new CityResources();

    this.hazards = [];

    this.playerSwarm = new SwarmController(20, this.canvas, 'friendly');
    this.enemySwarm  = new EnemySwarm(0, this.canvas, this.objectives);
    this.dataCollector = new DataCollector();
    this.hud = new HUD(this.canvas);
    this.waveAnnouncer = new WaveAnnouncer();
    this.commander = new Commander(this.canvas, this.playerSwarm, this.dataCollector, this);

    this.gameOverScreen = new GameOverScreen(() => this._restart());
    this.gameOverScreen.onExport(() => this.dataCollector.download());

    this.upgradeScreen = new UpgradeScreen();

    this.agent = new Agent(this.playerSwarm, this);
    this.aiMode = false;
    this._awaitingUpgrade = false;

    this.score = 0;
    this.wave = 0;
    this.running = true;
    this._lastTime = 0;
    this._waveDelay = 0;

    // Tutorial hints
    this._clickHintTimer = 4;

    // Mission state
    this._scoreMulti = 1;
    this._missionApproach = null;
    this._defenseProfile  = null;

    // Alert banner state
    this._alertText  = '';
    this._alertTimer = 0;

    new StartScreen().show().then(() => this._runMissionSetup());

    this.waveKills = 0;
    this.waveLosses = 0;
    this.totalKills = 0;
    this.totalLosses = 0;

    this._lasers = [];
  }

  /** Build the 3 city objectives at fixed triangle positions */
  _buildObjectives() {
    const W = this.canvas.width;
    const H = this.canvas.height;
    return [
      new Objective(W * 0.50, H * 0.16, 'power'),   // ⚡ top-center
      new Objective(W * 0.18, H * 0.68, 'water'),   // 💧 left
      new Objective(W * 0.82, H * 0.68, 'food'),    // 🌾 right
    ];
  }

  start() {
    requestAnimationFrame((t) => this._loop(t));
  }

  _restart() {
    this.objectives = this._buildObjectives();
    this.enemySwarm.objectives = this.objectives;
    this.cityResources.reset();
    this.hazards = [];
    this.score = 0;
    this.wave = 0;
    this.waveKills = 0;
    this.waveLosses = 0;
    this.totalKills = 0;
    this.totalLosses = 0;
    this._lasers = [];
    this._alertText = '';
    this._alertTimer = 0;
    this._clickHintTimer = 4;
    this.particles.particles.length = 0;
    this.playerSwarm.drones.length = 0;
    this.enemySwarm.drones.length = 0;
    this.running = true;
    this._runMissionSetup();
  }

  _runMissionSetup() {
    new MissionSetupScreen().show().then((setup) => {
      // Score multiplier from chosen target type (kept for scoring variety)
      this._scoreMulti = TARGET_TYPES[setup.targetId]?.scoreMulti ?? 1;
      this._scoreMulti *= (1 + (setup.defenseProfile.surpriseBonus ?? 0));

      // Build player swarm from loadout
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
    this._waveDelay = 1.5;
    this.waveKills = 0;
    this.waveLosses = 0;

    // Regenerate hazards (avoid all 3 objectives)
    this.hazards = generateHazards(
      this.wave, this.canvas.width, this.canvas.height,
      this.objectives
    );

    const isBossWave = this.wave % 5 === 0;
    this.waveAnnouncer.announce(this.wave, isBossWave);
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
    if (this._waveDelay > 0) this._waveDelay -= dt;
    if (this._clickHintTimer > 0) this._clickHintTimer -= dt;
    if (this._alertTimer > 0) this._alertTimer -= dt;
    if (this.aiMode) this.agent.update(dt);

    this._lasers = this._lasers.filter(l => (l.ttl -= dt) > 0);

    // Sync resource percentages from live objective HP
    this.cityResources.syncFromObjectives(this.objectives);

    // Apply cascading resource effects (passive depletion + starvation)
    this.cityResources.update(dt, this.playerSwarm, this.objectives);

    // Apply food speed penalty to player drones
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

    this._applyHazards(dt);
    this._checkCombat(dt);
    this._checkObjectiveHits();
    this._checkWaveComplete();
    this._checkGameOver();
  }

  _applyHazards(dt) {
    if (!this.hazards.length) return;
    const dpsMulti = this.cityResources.hazardDpsMultiplier();
    const all = [...this.playerSwarm.drones, ...this.enemySwarm.drones];
    for (const h of this.hazards) h.applyDamage(all, dt, dpsMulti);
    this.playerSwarm.drones = this.playerSwarm.drones.filter(d => !d.dead);
    this.enemySwarm.drones  = this.enemySwarm.drones.filter(d => !d.dead);
  }

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
    const OBJ_R2 = 30 * 30;
    const enemies = this.enemySwarm.drones;

    for (let j = enemies.length - 1; j >= 0; j--) {
      const e = enemies[j];
      for (const obj of this.objectives) {
        if (obj.health <= 0) continue; // already destroyed
        const dx = e.x - obj.x, dy = e.y - obj.y;
        if (dx * dx + dy * dy < OBJ_R2) {
          this.particles.explode(e.x, e.y, '#ff8800', 8);
          enemies.splice(j, 1);
          const prev = obj.health;
          obj.health = Math.max(0, obj.health - 10);
          this.shake.trigger(10, 0.35);
          this.audio.objectiveHit();
          // Show alert when objective first drops to 0
          if (prev > 0 && obj.health <= 0) {
            this._showAlert(`💥 ${obj._label} دُمِّرت!`);
          } else if (obj.health / obj.maxHealth <= 0.30 && prev / obj.maxHealth > 0.30) {
            this._showAlert(`⚠ ${obj._label} في خطر!`);
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

  _checkWaveComplete() {
    if (this._waveDelay > 0) return;
    if (this._awaitingUpgrade) return;
    if (this.enemySwarm.drones.length === 0 && !this.enemySwarm.spawning) {
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
      default: break;
    }
  }

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

  _checkGameOver() {
    if (this.cityResources.cityFallen()) {
      this.running = false;
      this.audio.gameOver();
      setTimeout(() => {
        this.gameOverScreen.show(this.score, this.wave, this.dataCollector.sampleCount);
      }, 600);
    }
  }

  // ── Rendering ──────────────────────────────────────────────────────────────

  _draw() {
    this.canvas.clear();
    this.ctx.save();
    this.shake.apply(this.ctx);

    this._drawGrid();
    this._drawCityConnections();
    for (const h of this.hazards) h.draw(this.ctx);
    for (const obj of this.objectives) obj.draw(this.ctx);
    this.commander.drawTargetZone(this.ctx);
    this._drawLasers();
    this.playerSwarm.draw(this.ctx);
    this.enemySwarm.draw(this.ctx);
    this.particles.draw(this.ctx);

    this.ctx.restore();

    this.waveAnnouncer.draw(this.ctx, this.canvas.width, this.canvas.height);
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

  /** Draw faint lines connecting the 3 objectives — city infrastructure */
  _drawCityConnections() {
    const ctx = this.ctx;
    ctx.save();
    ctx.strokeStyle = 'rgba(100,180,255,0.08)';
    ctx.lineWidth = 1;
    ctx.setLineDash([8, 12]);
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
    ctx.shadowBlur = 20;
    ctx.fillText(this._alertText, this.canvas.width / 2, this.canvas.height / 2 - 40);
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

  _drawGrid() {
    this.ctx.strokeStyle = 'rgba(30,60,90,0.25)';
    this.ctx.lineWidth = 1;
    const step = 60;
    for (let x = 0; x < this.canvas.width; x += step) {
      this.ctx.beginPath();
      this.ctx.moveTo(x, 0);
      this.ctx.lineTo(x, this.canvas.height);
      this.ctx.stroke();
    }
    for (let y = 0; y < this.canvas.height; y += step) {
      this.ctx.beginPath();
      this.ctx.moveTo(0, y);
      this.ctx.lineTo(this.canvas.width, y);
      this.ctx.stroke();
    }
  }
}
