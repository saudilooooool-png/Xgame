// Web Audio API — procedural sound effects, no assets needed
export class Audio {
  constructor() {
    try {
      this._ctx = new (window.AudioContext || window.webkitAudioContext)();
      this.enabled = true;
    } catch {
      this.enabled = false;
    }
  }

  _resume() {
    if (this._ctx?.state === 'suspended') this._ctx.resume();
  }

  _play(freq, type, duration, gainVal = 0.15, freqEnd) {
    if (!this.enabled) return;
    this._resume();
    try {
      const osc = this._ctx.createOscillator();
      const gain = this._ctx.createGain();
      osc.connect(gain);
      gain.connect(this._ctx.destination);

      osc.type = type;
      osc.frequency.setValueAtTime(freq, this._ctx.currentTime);
      if (freqEnd !== undefined) {
        osc.frequency.exponentialRampToValueAtTime(freqEnd, this._ctx.currentTime + duration);
      }

      gain.gain.setValueAtTime(gainVal, this._ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, this._ctx.currentTime + duration);

      osc.start(this._ctx.currentTime);
      osc.stop(this._ctx.currentTime + duration);
    } catch { /* ignore */ }
  }

  enemyDestroyed() {
    this._play(220, 'sawtooth', 0.15, 0.12, 80);
  }

  friendlyDestroyed() {
    this._play(180, 'square', 0.2, 0.08, 60);
  }

  objectiveHit() {
    this._play(100, 'sawtooth', 0.35, 0.2, 60);
  }

  waveStart() {
    this._play(440, 'sine', 0.1, 0.1);
    setTimeout(() => this._play(550, 'sine', 0.1, 0.1), 120);
    setTimeout(() => this._play(660, 'sine', 0.15, 0.12), 240);
  }

  formationChange() {
    this._play(330, 'sine', 0.08, 0.06, 440);
  }

  targetSet() {
    this._play(500, 'sine', 0.06, 0.05, 600);
  }

  gameOver() {
    this._play(440, 'sawtooth', 0.5, 0.2, 110);
    setTimeout(() => this._play(110, 'sawtooth', 0.8, 0.25, 55), 300);
  }

  /** 3-2-1 countdown beep — pitch rises as we approach zero */
  countdownBeep(n) {
    const freq = n === 3 ? 330 : n === 2 ? 440 : 660;
    this._play(freq, 'sine', 0.18, 0.22);
  }

  /** Deep rumble before a boss wave */
  bossWarning() {
    this._play(55, 'sawtooth', 0.9, 0.30, 40);
    setTimeout(() => this._play(80, 'sawtooth', 0.7, 0.28, 55), 350);
    setTimeout(() => this._play(110, 'sine',    0.5, 0.18, 80), 700);
  }

  /** Gentle arpeggio for rest waves */
  restWave() {
    this._play(660, 'sine', 0.35, 0.07, 880);
    setTimeout(() => this._play(880, 'sine', 0.30, 0.06, 1100), 180);
    setTimeout(() => this._play(1100, 'sine', 0.25, 0.05, 1320), 360);
  }

  /** Rapid ascending burst for blitz/swarm waves */
  blitzAlert() {
    this._play(220, 'sawtooth', 0.08, 0.18, 330);
    setTimeout(() => this._play(330, 'sawtooth', 0.08, 0.20, 440), 80);
    setTimeout(() => this._play(440, 'sawtooth', 0.08, 0.22, 660), 160);
    setTimeout(() => this._play(660, 'sawtooth', 0.08, 0.25, 880), 240);
  }

  /** Stealthy low pulse for stealth waves */
  stealthAlert() {
    this._play(110, 'sine', 0.4, 0.12, 88);
    setTimeout(() => this._play(88, 'sine', 0.3, 0.10, 66), 500);
  }
}
