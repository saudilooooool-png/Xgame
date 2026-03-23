import { Canvas } from './Canvas.js';
import { ParticleSystem } from './Particles.js';
import { ScreenShake } from './ScreenShake.js';
import { Audio } from './Audio.js';
import { SwarmController } from '../entities/SwarmController.js';
import { EnemySwarm } from '../entities/EnemySwarm.js';
import { Objective } from '../entities/Objective.js';
import { generateHazards } from '../entities/HazardZone.js';
import { DataCollector } from '../data/DataCollector.js';
import { Commander } from '../ui/Commander.js';
import { HUD } from '../ui/HUD.js';
import { WaveAnnouncer } from '../ui/WaveAnnouncer.js';
import { GameOverScreen } from '../ui/GameOverScreen.js';
import { Agent } from '../ai/Agent.js';
import { UpgradeScreen } from '../ui/UpgradeScreen.js';

export class Game {
  constructor() {
    this.canvas = new Canvas('game-container');
    this.ctx = this.canvas.ctx;

    this.particles = new ParticleSystem();
    this.shake = new ScreenShake();
    this.audio = new Audio();

    // Possible objective positions — rotated every 3 waves for tactical variety
    this._objectivePositions = [
      { x: this.canvas.width / 2,       y: this.canvas.height / 2      },
      { x: this.canvas.width * 0.25,    y: this.canvas.height * 0.25   },
      { x: this.canvas.width * 0.75,    y: this.canvas.height * 0.25   },
      { x: this.canvas.width * 0.25,    y: this.canvas.height * 0.75   },
      { x: this.canvas.width * 0.75,    y: this.canvas.height * 0.75   },
    ];
    this._objectivePosIndex = 0;
    this.objective = new Objective(this._objectivePositions[0].x, this._objectivePositions[0].y);

    this.hazards = [];  // HazardZone[] — refreshed each wave

    this.playerSwarm = new SwarmController(20, this.canvas, 'friendly');
    this.enemySwarm = new EnemySwarm(0, this.canvas, this.objective);
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

    // Combat tracking (reset each wave)
    this.waveKills = 0;
    this.waveLosses = 0;
    this.totalKills = 0;
    this.totalLosses = 0;

    // Laser visual effects [{x1,y1,x2,y2,color,ttl}]
    this._lasers = [];
    this._awaitingUpgrade = false;

    this._nextWave();
  }

  start() {
    requestAnimationFrame((t) => this._loop(t));
  }

  _restart() {
    this._objectivePosIndex = 0;
    const p0 = this._objectivePositions[0];
    this.objective.x = p0.x;
    this.objective.y = p0.y;
    this.objective.health = 100;
    this.hazards = [];
    this.score = 0;
    this.wave = 0;
    this.waveKills = 0;
    this.waveLosses = 0;
    this.totalKills = 0;
    this.totalLosses = 0;
    this._lasers = [];
    this.particles.particles.length = 0;
    this.playerSwarm.drones.length = 0;
    this.playerSwarm.reinforce(20);
    this.enemySwarm.drones.length = 0;
    this.running = true;
    this._nextWave();
  }

  _nextWave() {
    this.wave++;
    this._waveDelay = 1.5;
    this.waveKills = 0;
    this.waveLosses = 0;

    // Relocate objective every 3 waves (wave 4, 7, 10, …)
    if (this.wave > 1 && (this.wave - 1) % 3 === 0) {
      this._objectivePosIndex =
        (this._objectivePosIndex + 1) % this._objectivePositions.length;
      const np = this._objectivePositions[this._objectivePosIndex];
      this.objective.x = np.x;
      this.objective.y = np.y;
      this._objectiveRelocated = true;   // consumed by _draw to show banner
    } else {
      this._objectiveRelocated = false;
    }

    // Generate hazard zones for this wave
    this.hazards = generateHazards(
      this.wave, this.canvas.width, this.canvas.height,
      this.objective.x, this.objective.y
    );

    const isBossWave = this.wave % 5 === 0;
    this.waveAnnouncer.announce(this.wave, isBossWave);
    this.audio.waveStart();
    this.enemySwarm.spawnWave(this.wave);
    if (this.wave > 1 && this.playerSwarm.drones.length < 20) {
      this.playerSwarm.reinforce(Math.min(5, 20 - this.playerSwarm.drones.length));
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
    if (this.aiMode && !this.agent.active) {
      this.agent.load();
    }
  }

  _update(dt) {
    if (this._waveDelay > 0) this._waveDelay -= dt;
    if (this.aiMode) this.agent.update(dt);

    // age laser effects
    this._lasers = this._lasers.filter(l => (l.ttl -= dt) > 0);

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

  /** Apply hazard damage to all drones inside each zone */
  _applyHazards(dt) {
    if (!this.hazards.length) return;
    const all = [...this.playerSwarm.drones, ...this.enemySwarm.drones];
    for (const h of this.hazards) h.applyDamage(all, dt);
    // Remove drones killed by hazards
    this.playerSwarm.drones = this.playerSwarm.drones.filter(d => !d.dead);
    this.enemySwarm.drones  = this.enemySwarm.drones.filter(d => !d.dead);
  }

  _checkCombat(dt) {
    const friendly = this.playerSwarm.drones;
    const enemies  = this.enemySwarm.drones;

    // ── Friendly drones fire at nearest enemy ─────────────────────────────────
    for (const p of friendly) {
      const target = p.findTarget(enemies);
      if (!target) continue;
      if (!p.tickFire(dt)) continue;

      // fire!
      this._lasers.push({ x1: p.x, y1: p.y, x2: target.x, y2: target.y,
                          color: '#00d4ff', ttl: 0.08 });
      if (target.takeDamage(p.fireDamage)) {
        this.particles.explode(target.x, target.y, '#ff3c3c', 10);
        this.audio.enemyDestroyed();
        this.score += 10;
        this.waveKills++;
        this.totalKills++;
      }
    }

    // ── Enemy drones fire at nearest friendly ─────────────────────────────────
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

    // Remove dead drones
    this.playerSwarm.drones = friendly.filter(d => !d.dead);
    this.enemySwarm.drones  = enemies.filter(d => !d.dead);
  }

  _checkObjectiveHits() {
    const OBJ_R2 = 30 * 30;
    const enemies = this.enemySwarm.drones;
    for (let j = enemies.length - 1; j >= 0; j--) {
      const e = enemies[j];
      const dx = e.x - this.objective.x, dy = e.y - this.objective.y;
      if (dx * dx + dy * dy < OBJ_R2) {
        this.particles.explode(e.x, e.y, '#ff8800', 8);
        enemies.splice(j, 1);
        this.objective.health = Math.max(0, this.objective.health - 10);
        this.shake.trigger(10, 0.35);
        this.audio.objectiveHit();
      }
    }
  }

  _checkWaveComplete() {
    if (this._waveDelay > 0) return;
    if (this._awaitingUpgrade) return;
    if (this.enemySwarm.drones.length === 0 && !this.enemySwarm.spawning) {
      this.score += 100 * this.wave;
      this._awaitingUpgrade = true;
      this.upgradeScreen
        .show(this.wave, {
          kills: this.waveKills,
          losses: this.waveLosses,
          score: this.score,
        })
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
      case 'drones':
        this.playerSwarm.reinforce(5);
        break;
      case 'firepower':
        for (const d of drones) d.fireDamage = Math.round(d.fireDamage * 1.30);
        break;
      case 'speed':
        for (const d of drones) { d.maxSpeed = Math.round(d.maxSpeed * 1.20); }
        break;
      default:
        break;
    }
  }

  /** Returns threat score [0-1]: how many enemies are close to objective */
  threatScore() {
    const THREAT_R = 250;
    const enemies = this.enemySwarm.drones;
    if (!enemies.length) return 0;
    let near = 0;
    for (const e of enemies) {
      const dx = e.x - this.objective.x, dy = e.y - this.objective.y;
      if (dx * dx + dy * dy < THREAT_R * THREAT_R) near++;
    }
    return near / enemies.length;
  }

  _checkGameOver() {
    if (this.objective.health <= 0) {
      this.running = false;
      this.audio.gameOver();
      setTimeout(() => {
        this.gameOverScreen.show(this.score, this.wave, this.dataCollector.sampleCount);
      }, 600);
    }
  }

  _draw() {
    this.canvas.clear();
    this.ctx.save();
    this.shake.apply(this.ctx);

    this._drawGrid();
    // Draw hazard zones beneath everything else
    for (const h of this.hazards) h.draw(this.ctx);
    this.objective.draw(this.ctx);
    this.commander.drawTargetZone(this.ctx);
    this._drawLasers();
    this.playerSwarm.draw(this.ctx);
    this.enemySwarm.draw(this.ctx);
    this.particles.draw(this.ctx);

    this.ctx.restore();

    this.waveAnnouncer.draw(this.ctx, this.canvas.width, this.canvas.height);
    this._drawRelocateBanner();
    this.hud.draw(
      this.score, this.wave, this.objective.health,
      this.playerSwarm.drones.length, this.playerSwarm.currentFormation,
      this.dataCollector.sampleCount, this.dataCollector.serverStatus,
      this.totalKills, this.totalLosses,
      this.hazards.length, this.wave % 5 === 0
    );
  }

  _drawRelocateBanner() {
    if (!this._objectiveRelocated) return;
    // Show banner only during the wave delay period
    if (this._waveDelay <= 0) { this._objectiveRelocated = false; return; }
    const ctx = this.ctx;
    const alpha = Math.min(1, this._waveDelay / 1.5);
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.font = 'bold 18px monospace';
    ctx.textAlign = 'center';
    ctx.fillStyle = '#ffcc00';
    ctx.shadowColor = '#ff8800';
    ctx.shadowBlur = 14;
    ctx.fillText('⚡ OBJECTIVE RELOCATED', this.canvas.width / 2, this.canvas.height / 2 + 50);
    ctx.globalAlpha = 1;
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
