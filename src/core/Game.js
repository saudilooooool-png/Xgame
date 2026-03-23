import { Canvas } from './Canvas.js';
import { ParticleSystem } from './Particles.js';
import { ScreenShake } from './ScreenShake.js';
import { Audio } from './Audio.js';
import { SwarmController } from '../entities/SwarmController.js';
import { EnemySwarm } from '../entities/EnemySwarm.js';
import { Objective } from '../entities/Objective.js';
import { DataCollector } from '../data/DataCollector.js';
import { Commander } from '../ui/Commander.js';
import { HUD } from '../ui/HUD.js';
import { WaveAnnouncer } from '../ui/WaveAnnouncer.js';
import { GameOverScreen } from '../ui/GameOverScreen.js';

export class Game {
  constructor() {
    this.canvas = new Canvas('game-container');
    this.ctx = this.canvas.ctx;

    this.particles = new ParticleSystem();
    this.shake = new ScreenShake();
    this.audio = new Audio();

    this.objective = new Objective(this.canvas.width / 2, this.canvas.height / 2);
    this.playerSwarm = new SwarmController(20, this.canvas, 'friendly');
    this.enemySwarm = new EnemySwarm(0, this.canvas, this.objective);
    this.dataCollector = new DataCollector();
    this.hud = new HUD(this.canvas);
    this.waveAnnouncer = new WaveAnnouncer();
    this.commander = new Commander(this.canvas, this.playerSwarm, this.dataCollector, this);

    this.gameOverScreen = new GameOverScreen(() => this._restart());
    this.gameOverScreen.onExport(() => this.dataCollector.download());

    this.score = 0;
    this.wave = 0;
    this.running = true;
    this._lastTime = 0;
    this._waveDelay = 0; // cooldown between waves

    this._nextWave();
  }

  start() {
    requestAnimationFrame((t) => this._loop(t));
  }

  _restart() {
    // Reset everything in-place
    this.objective.health = 100;
    this.score = 0;
    this.wave = 0;
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
    this.waveAnnouncer.announce(this.wave);
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

  _update(dt) {
    if (this._waveDelay > 0) this._waveDelay -= dt;

    this.playerSwarm.update(dt, this.enemySwarm.drones);
    this.enemySwarm.update(dt, this.playerSwarm.drones);
    this.particles.update(dt);
    this.shake.update(dt);
    this.waveAnnouncer.update(dt);

    this._checkCollisions();
    this._checkWaveComplete();
    this._checkGameOver();
  }

  _checkCollisions() {
    const KILL_R2 = 18 * 18;
    const OBJ_R2 = 30 * 30;

    for (let i = this.playerSwarm.drones.length - 1; i >= 0; i--) {
      const p = this.playerSwarm.drones[i];
      for (let j = this.enemySwarm.drones.length - 1; j >= 0; j--) {
        const e = this.enemySwarm.drones[j];
        const dx = p.x - e.x, dy = p.y - e.y;
        if (dx * dx + dy * dy < KILL_R2) {
          // Both explode
          this.particles.explode(e.x, e.y, '#ff3c3c', 10);
          this.particles.explode(p.x, p.y, '#00d4ff', 6);
          this.audio.enemyDestroyed();
          this.playerSwarm.drones.splice(i, 1);
          this.enemySwarm.drones.splice(j, 1);
          this.score += 10;
          break;
        }
      }
    }

    // enemy reaches objective
    for (let j = this.enemySwarm.drones.length - 1; j >= 0; j--) {
      const e = this.enemySwarm.drones[j];
      const dx = e.x - this.objective.x, dy = e.y - this.objective.y;
      if (dx * dx + dy * dy < OBJ_R2) {
        this.particles.explode(e.x, e.y, '#ff8800', 8);
        this.enemySwarm.drones.splice(j, 1);
        this.objective.health = Math.max(0, this.objective.health - 10);
        this.shake.trigger(10, 0.35);
        this.audio.objectiveHit();
      }
    }
  }

  _checkWaveComplete() {
    if (this._waveDelay > 0) return;
    if (this.enemySwarm.drones.length === 0 && !this.enemySwarm.spawning) {
      this.score += 100 * this.wave;
      this._nextWave();
    }
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
    this.objective.draw(this.ctx);
    this.commander.drawTargetZone(this.ctx);
    this.playerSwarm.draw(this.ctx);
    this.enemySwarm.draw(this.ctx);
    this.particles.draw(this.ctx);

    this.ctx.restore();

    this.waveAnnouncer.draw(this.ctx, this.canvas.width, this.canvas.height);
    this.hud.draw(
      this.score, this.wave, this.objective.health,
      this.playerSwarm.drones.length, this.playerSwarm.currentFormation,
      this.dataCollector.sampleCount, this.dataCollector.serverStatus
    );
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
