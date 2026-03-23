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
}
