import { Canvas } from './Canvas.js';
import { SwarmController } from '../entities/SwarmController.js';
import { EnemySwarm } from '../entities/EnemySwarm.js';
import { Objective } from '../entities/Objective.js';
import { DataCollector } from '../data/DataCollector.js';
import { Commander } from '../ui/Commander.js';
import { HUD } from '../ui/HUD.js';

export class Game {
  constructor() {
    this.canvas = new Canvas('game-container');
    this.ctx = this.canvas.ctx;

    this.objective = new Objective(this.canvas.width / 2, this.canvas.height / 2);
    this.playerSwarm = new SwarmController(20, this.canvas, 'friendly');
    this.enemySwarm = new EnemySwarm(15, this.canvas, this.objective);
    this.dataCollector = new DataCollector();
    this.hud = new HUD(this.canvas);
    this.commander = new Commander(
      this.canvas,
      this.playerSwarm,
      this.dataCollector,
      this
    );

    this.score = 0;
    this.wave = 1;
    this.running = true;
    this._lastTime = 0;
  }

  start() {
    requestAnimationFrame((t) => this._loop(t));
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
    this.playerSwarm.update(dt, this.enemySwarm.drones);
    this.enemySwarm.update(dt, this.playerSwarm.drones);
    this._checkCollisions();
    this._checkWaveComplete();
  }

  _checkCollisions() {
    const KILL_RADIUS = 18;
    for (let i = this.playerSwarm.drones.length - 1; i >= 0; i--) {
      const p = this.playerSwarm.drones[i];
      for (let j = this.enemySwarm.drones.length - 1; j >= 0; j--) {
        const e = this.enemySwarm.drones[j];
        const dx = p.x - e.x;
        const dy = p.y - e.y;
        if (dx * dx + dy * dy < KILL_RADIUS * KILL_RADIUS) {
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
      const dx = e.x - this.objective.x;
      const dy = e.y - this.objective.y;
      if (dx * dx + dy * dy < 30 * 30) {
        this.enemySwarm.drones.splice(j, 1);
        this.objective.health = Math.max(0, this.objective.health - 10);
      }
    }
  }

  _checkWaveComplete() {
    if (this.enemySwarm.drones.length === 0 && !this.enemySwarm.spawning) {
      this.wave++;
      this.score += 100;
      this.enemySwarm.spawnWave(this.wave);
      if (this.playerSwarm.drones.length < 20) {
        this.playerSwarm.reinforce(5);
      }
    }
  }

  _draw() {
    this.canvas.clear();
    this._drawGrid();
    this.objective.draw(this.ctx);
    this.commander.drawTargetZone(this.ctx);
    this.playerSwarm.draw(this.ctx);
    this.enemySwarm.draw(this.ctx);
    this.hud.draw(this.score, this.wave, this.objective.health,
      this.playerSwarm.drones.length, this.playerSwarm.currentFormation,
      this.dataCollector.sampleCount);
  }

  _drawGrid() {
    this.ctx.strokeStyle = 'rgba(30,60,90,0.3)';
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
