const SERVER_URL = 'http://localhost:4000/api';
const FLUSH_INTERVAL = 15_000; // send every 15 seconds
const FLUSH_BATCH = 10;        // or every 10 samples

export class DataCollector {
  constructor() {
    this.samples = [];
    this.sampleCount = 0;
    this._sessionId = `session_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    this._serverAvailable = null; // null=unknown, true, false
    this._lastFlush = Date.now();

    this._checkServer();
    setInterval(() => this._flush(), FLUSH_INTERVAL);
    window.addEventListener('beforeunload', () => this._flush(true));
  }

  recordDecision(gameState, action) {
    const sample = {
      id: `${this._sessionId}_${this.sampleCount}`,
      sessionId: this._sessionId,
      timestamp: Date.now(),
      gameState,
      action,
      outcome: null,
    };
    this.samples.push(sample);
    this.sampleCount++;

    if (action._resolveAfter) {
      setTimeout(() => {
        sample.outcome = action._resolveAfter();
        delete action._resolveAfter;
        if (this._serverAvailable) this._flush();
      }, 5000);
    }

    if (this.sampleCount % FLUSH_BATCH === 0) this._flush();
  }

  /**
   * Enriches the latest sample with combat outcome after a decision window.
   * Called by Commander after each player action.
   * @param {Function} snapshotFn — called after `delayMs` to get {kills,losses,threatScore,objectiveHealth}
   */
  resolveOutcome(sampleIdx, snapshotFn, delayMs = 4000) {
    const sample = this.samples[sampleIdx];
    if (!sample) return;
    setTimeout(() => {
      const snap = snapshotFn();
      sample.outcome = {
        kills:           snap.kills,
        losses:          snap.losses,
        threatScore:     snap.threatScore,
        objectiveHealth: snap.objectiveHealth,
        // reward: positive when we kill more than we lose, scaled by threat
        reward: (snap.kills - snap.losses) + (1 - snap.threatScore) * 2,
      };
      if (this._serverAvailable) this._flush();
    }, delayMs);
  }

  // ── Server sync ────────────────────────────────────────────────────────────

  async _checkServer() {
    try {
      const res = await fetch(`${SERVER_URL}/stats`, { signal: AbortSignal.timeout(2000) });
      this._serverAvailable = res.ok;
    } catch {
      this._serverAvailable = false;
    }
  }

  async _flush(sync = false) {
    if (!this._serverAvailable) return;
    const toSend = this.samples.filter((s) => !s._sent);
    if (toSend.length === 0) return;

    const payload = {
      samples: toSend,
      session: {
        sessionId: this._sessionId,
        startedAt: parseInt(this._sessionId.split('_')[1]),
        sampleCount: toSend.length,
      },
    };

    const send = () => fetch(`${SERVER_URL}/samples`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      keepalive: sync,
    }).then((r) => {
      if (r.ok) toSend.forEach((s) => { s._sent = true; });
    }).catch(() => {});

    if (sync) {
      // best-effort synchronous send on page unload
      navigator.sendBeacon
        ? navigator.sendBeacon(`${SERVER_URL}/samples`, JSON.stringify(payload))
        : send();
    } else {
      await send();
    }
  }

  // ── Export (fallback manual download) ─────────────────────────────────────

  export() {
    return JSON.stringify(this.samples, null, 2);
  }

  download() {
    const blob = new Blob([this.export()], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `swarm_data_${this._sessionId}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  get serverStatus() { return this._serverAvailable; }
}
