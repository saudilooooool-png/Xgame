import { CANVAS_WIDTH, CANVAS_HEIGHT, PLAYER_MAX_LIVES, SCORE_BONUS_WAVE } from './constants.js';
import { Player } from './Player.js';
import { EnemyGrid } from './EnemyGrid.js';
import { StarField } from './StarField.js';
import { InputHandler } from './InputHandler.js';

export class Game {
  constructor(canvas, onGameOver, onScoreChange, onLivesChange, onLevelChange) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.onGameOver = onGameOver;
    this.onScoreChange = onScoreChange;
    this.onLivesChange = onLivesChange;
    this.onLevelChange = onLevelChange;

    canvas.width = CANVAS_WIDTH;
    canvas.height = CANVAS_HEIGHT;

    this._reset();
  }

  _reset() {
    this.score = 0;
    this.lives = PLAYER_MAX_LIVES;
    this.wave = 1;
    this.running = false;
    this.paused = false;
    this.lastTime = null;
    this.rafId = null;

    this.player = new Player();
    this.bullets = [];
    this.particles = [];
    this.stars = new StarField();
    this.grid = new EnemyGrid(this.wave);
    this.input = new InputHandler();
    this._pausePressed = false;
  }

  start() {
    this.running = true;
    this.lastTime = performance.now();
    this._loop(this.lastTime);
  }

  pause() {
    this.paused = true;
    cancelAnimationFrame(this.rafId);
  }

  resume() {
    this.paused = false;
    this.lastTime = performance.now();
    this._loop(this.lastTime);
  }

  stop() {
    this.running = false;
    cancelAnimationFrame(this.rafId);
    this.input.destroy();
  }

  _loop(timestamp) {
    if (!this.running || this.paused) return;
    const dt = Math.min(timestamp - this.lastTime, 50); // cap dt
    this.lastTime = timestamp;
    this._update(dt, timestamp);
    this._draw(timestamp);
    this.rafId = requestAnimationFrame(t => this._loop(t));
  }

  _update(dt, now) {
    // Pause toggle
    if (this.input.pause) {
      if (!this._pausePressed) {
        this._pausePressed = true;
        this.pause();
        document.dispatchEvent(new CustomEvent('game:pause'));
        return;
      }
    } else {
      this._pausePressed = false;
    }

    this.stars.update();

    // Player update
    this.player.update(this.input, this.bullets, now);

    // Bullet updates
    for (const b of this.bullets) b.update();
    this.bullets = this.bullets.filter(b => b.active);

    // Enemy grid update
    this.grid.update(dt, this.bullets, this.particles);

    // Hit detection: player bullets vs enemies
    this.grid.checkBulletHits(this.bullets, (enemy) => {
      this.grid.spawnParticles(enemy, this.particles);
      this.score += enemy.scoreValue;
      this.onScoreChange(this.score);
    });

    // Hit detection: enemy bullets vs player
    if (!this.player.isInvincible) {
      for (const b of this.bullets) {
        if (!b.active || b.owner !== 'enemy') continue;
        if (this.player.collidesWith(b)) {
          b.active = false;
          this._loseLife();
          return;
        }
      }
    }

    // Enemy reached bottom
    if (this.grid.hasReachedBottom(CANVAS_HEIGHT - 40)) {
      this._loseLife();
      return;
    }

    // Particles
    for (const p of this.particles) p.update(dt);
    this.particles = this.particles.filter(p => p.alive);

    // Wave complete
    if (!this.grid.alive) {
      this.score += SCORE_BONUS_WAVE;
      this.onScoreChange(this.score);
      this.wave++;
      this.onLevelChange(this.wave);
      this.grid = new EnemyGrid(this.wave);
      this.bullets = [];
    }
  }

  _loseLife() {
    this.lives--;
    this.onLivesChange(this.lives);
    if (this.lives <= 0) {
      this.stop();
      this.onGameOver(this.score);
    } else {
      this.player.reset();
      this.player.makeInvincible();
      // Remove enemy bullets
      this.bullets = this.bullets.filter(b => b.owner !== 'enemy');
    }
  }

  _draw(now) {
    const ctx = this.ctx;
    ctx.clearRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

    // Background
    ctx.fillStyle = '#0a0a1a';
    ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

    this.stars.draw(ctx);

    for (const b of this.bullets) b.draw(ctx);
    for (const enemy of this.grid.enemies) {
      if (enemy.active) enemy.draw(ctx);
    }
    this.player.draw(ctx, now);
    for (const p of this.particles) p.draw(ctx);

    // Ground line
    ctx.strokeStyle = '#1a2a3a';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, CANVAS_HEIGHT - 20);
    ctx.lineTo(CANVAS_WIDTH, CANVAS_HEIGHT - 20);
    ctx.stroke();
  }
}
