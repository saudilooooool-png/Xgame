/**
 * CityResources — tracks the 3 vital city resources and their cascading effects.
 *
 * Resources are synced from their corresponding Objective HP each frame.
 * When a resource runs low / is destroyed, it cascades into others.
 *
 *   ⚡ Power  → 0: Water depletes passively 3/s
 *   💧 Water  → 0: Food depletes passively 2/s + hazard zones intensify
 *   🌾 Food   → 0: player drones lose speed + 1 drone dies every 20s
 */

export const RESOURCE_DEFS = {
  power: {
    id:          'power',
    icon:        '⚡',
    label:       'الكهرباء',
    color:       '#ffcc00',
    shadowColor: '#ff8800',
    hp:          100,
  },
  water: {
    id:          'water',
    icon:        '💧',
    label:       'المياه',
    color:       '#00aaff',
    shadowColor: '#0066cc',
    hp:          120,
  },
  food: {
    id:          'food',
    icon:        '🌾',
    label:       'الغذاء',
    color:       '#88ff44',
    shadowColor: '#44aa00',
    hp:          140,
  },
};

export class CityResources {
  constructor() {
    // 0-100 percentage of each resource remaining
    this.power = 100;
    this.water = 100;
    this.food  = 100;
    this._starvationTimer = 0;
  }

  reset() {
    this.power = 100;
    this.water = 100;
    this.food  = 100;
    this._starvationTimer = 0;
  }

  /**
   * Sync resource percentages from the live objective HP values.
   * Called every frame in Game._update().
   */
  syncFromObjectives(objectives) {
    for (const obj of objectives) {
      const pct = obj.maxHealth > 0 ? (obj.health / obj.maxHealth) * 100 : 0;
      if      (obj.resourceType === 'power') this.power = pct;
      else if (obj.resourceType === 'water') this.water = pct;
      else if (obj.resourceType === 'food')  this.food  = pct;
    }
  }

  /**
   * Apply cascading passive effects each frame.
   * @param {number} dt - delta time seconds
   * @param {SwarmController} playerSwarm
   * @param {Objective[]} objectives - so we can drain water/food objectives directly
   */
  update(dt, playerSwarm, objectives) {
    const waterObj = objectives.find(o => o.resourceType === 'water');
    const foodObj  = objectives.find(o => o.resourceType === 'food');

    // Cascade 1: no power → water drains passively
    if (this.power <= 0 && waterObj && waterObj.health > 0) {
      waterObj.health = Math.max(0, waterObj.health - 3 * dt);
    }

    // Cascade 2: no water → food drains passively
    if (this.water <= 0 && foodObj && foodObj.health > 0) {
      foodObj.health = Math.max(0, foodObj.health - 2 * dt);
    }

    // Cascade 3: no food → lose 1 drone every 20s (starvation)
    if (this.food <= 0 && playerSwarm.drones.length > 1) {
      this._starvationTimer += dt;
      if (this._starvationTimer >= 20) {
        this._starvationTimer = 0;
        playerSwarm.drones.pop();
      }
    } else {
      this._starvationTimer = 0;
    }
  }

  /** Speed multiplier applied to player drones (food effect). */
  speedModifier() {
    if (this.food <= 0)  return 0.70;
    if (this.food < 30)  return 0.85;
    return 1.0;
  }

  /** DPS multiplier for hazard zones (water effect). */
  hazardDpsMultiplier() {
    if (this.water <= 0)  return 2.0;
    if (this.water < 30)  return 1.5;
    return 1.0;
  }

  /** True only when all 3 resources are completely gone. */
  cityFallen() {
    return this.power <= 0 && this.water <= 0 && this.food <= 0;
  }

  /** Which resources are in critical state (<= 30%) */
  criticalResources() {
    const out = [];
    if (this.power <= 30) out.push('power');
    if (this.water <= 30) out.push('water');
    if (this.food  <= 30) out.push('food');
    return out;
  }
}
