/**
 * DataCollector — records {gameState → playerDecision → outcome} tuples.
 *
 * Each "sample" is captured when the player issues a command (formation change
 * or target zone selection).  The outcome (success/fail) is written back
 * 5 seconds later based on whether the swarm achieved its goal.
 *
 * Format compatible with Imitation Learning / Behavioural Cloning pipelines.
 */
export class DataCollector {
  constructor() {
    this.samples = [];
    this._pending = []; // waiting for outcome resolution
    this.sampleCount = 0;
  }

  /**
   * Called by Commander each time the player issues a command.
   * @param {Object} gameState  - serialized field snapshot
   * @param {Object} action     - {type, formation?, targetX?, targetY?, wave, score}
   */
  recordDecision(gameState, action) {
    const sample = {
      id: Date.now(),
      timestamp: Date.now(),
      gameState,
      action,
      outcome: null, // filled in later
    };
    this._pending.push(sample);
    this.samples.push(sample);
    this.sampleCount++;

    // auto-resolve outcome after 5 s based on a snapshot callback
    if (action._resolveAfter) {
      setTimeout(() => {
        sample.outcome = action._resolveAfter();
        delete action._resolveAfter;
      }, 5000);
    }
  }

  /** Returns all completed samples (outcome != null) as JSON string */
  export() {
    const completed = this.samples.filter((s) => s.outcome !== null);
    return JSON.stringify(completed, null, 2);
  }

  /** Triggers a browser download of the dataset */
  download() {
    const blob = new Blob([this.export()], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `swarm_training_data_${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }
}
