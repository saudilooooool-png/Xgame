/**
 * Enemy role configurations
 *
 * rusher  — fast, low HP, dashes straight to objective
 * flanker — medium speed, circles around the friendly swarm
 * sniper  — slow, keeps distance, fires from long range
 */
export const ENEMY_ROLES = {
  rusher: {
    color: '#ff3c3c',
    shadowColor: '#ff3c3c',
    hp: 60,
    maxHp: 60,
    maxSpeed: 110,
    fireRange: 75,
    fireDamage: 20,
    fireRate: 1.1,
    boids: {
      separationRadius: 22, separationWeight: 1.4,
      alignmentRadius: 55,  alignmentWeight: 0.5,
      cohesionRadius: 55,   cohesionWeight: 0.4,
      seekWeight: 3.0, maxForce: 0.40, maxSpeed: 110,
    },
  },

  flanker: {
    color: '#ff8800',
    shadowColor: '#ff8800',
    hp: 80,
    maxHp: 80,
    maxSpeed: 80,
    fireRange: 105,
    fireDamage: 28,
    fireRate: 0.9,
    boids: {
      separationRadius: 26, separationWeight: 1.6,
      alignmentRadius: 65,  alignmentWeight: 0.7,
      cohesionRadius: 65,   cohesionWeight: 0.5,
      seekWeight: 2.2, maxForce: 0.35, maxSpeed: 80,
    },
  },

  sniper: {
    color: '#cc44ff',
    shadowColor: '#cc44ff',
    hp: 50,
    maxHp: 50,
    maxSpeed: 50,
    fireRange: 210,
    fireDamage: 42,
    fireRate: 1.8,
    boids: {
      separationRadius: 30, separationWeight: 1.8,
      alignmentRadius: 70,  alignmentWeight: 0.4,
      cohesionRadius: 70,   cohesionWeight: 0.3,
      seekWeight: 1.2, maxForce: 0.25, maxSpeed: 50,
    },
  },
};

/** Boss — spawns once per boss wave (every 5th wave), one per wave */
export const BOSS_ROLE = {
  color: '#ffdd00',
  shadowColor: '#ffaa00',
  hp: 450,
  maxHp: 450,
  maxSpeed: 38,
  fireRange: 170,
  fireDamage: 55,
  fireRate: 2.2,
  scale: 2.8,           // visual scale multiplier
  boids: {
    separationRadius: 50, separationWeight: 2.0,
    alignmentRadius: 90,  alignmentWeight: 0.3,
    cohesionRadius: 90,   cohesionWeight: 0.2,
    seekWeight: 1.8, maxForce: 0.30, maxSpeed: 38,
  },
};

/**
 * Returns a scaled config for a role at a given wave.
 * Enemies get gradually harder each wave cycle.
 */
export function getScaledConfig(role, wave) {
  const base = { ...ENEMY_ROLES[role] };
  const tier = Math.floor((wave - 1) / 3);  // tier 0 = waves 1-3, tier 1 = 4-6, …
  if (tier === 0) return base;

  const hpMult  = 1 + tier * 0.18;
  const spdMult = 1 + tier * 0.08;
  const dmgMult = 1 + tier * 0.10;

  return {
    ...base,
    hp: Math.round(base.hp * hpMult),
    maxHp: Math.round(base.maxHp * hpMult),
    maxSpeed: Math.round(base.maxSpeed * spdMult),
    fireDamage: Math.round(base.fireDamage * dmgMult),
    boids: { ...base.boids, maxSpeed: Math.round(base.boids.maxSpeed * spdMult) },
  };
}

/**
 * Returns an array of role names for a given wave number.
 * wave 1   → all rushers
 * wave 2   → rushers + flankers
 * wave 3+  → rushers + flankers + snipers
 * wave 5+  → heavier mix; every 5th wave is a "boss" wave with extra enemies
 */
/**
 * Returns an array of role names for a given wave number.
 * Optional roleWeights overrides default ratios (from DefenderAI strategy).
 */
export function waveComposition(wave, count, roleWeights = null) {
  let rushRatio, flankRatio, snipeRatio;

  if (roleWeights) {
    // Use defender strategy weights
    const total = (roleWeights.rusher ?? 0) + (roleWeights.flanker ?? 0) + (roleWeights.sniper ?? 0) || 1;
    rushRatio  = (roleWeights.rusher  ?? 0) / total;
    flankRatio = (roleWeights.flanker ?? 0) / total;
    snipeRatio = (roleWeights.sniper  ?? 0) / total;
  } else if (wave === 1) {
    [rushRatio, flankRatio, snipeRatio] = [1.00, 0.00, 0.00];
  } else if (wave === 2) {
    [rushRatio, flankRatio, snipeRatio] = [0.70, 0.30, 0.00];
  } else if (wave === 3) {
    [rushRatio, flankRatio, snipeRatio] = [0.55, 0.30, 0.15];
  } else if (wave < 6) {
    [rushRatio, flankRatio, snipeRatio] = [0.40, 0.38, 0.22];
  } else {
    [rushRatio, flankRatio, snipeRatio] = [0.30, 0.40, 0.30];
  }

  const roles = [];
  for (let i = 0; i < count; i++) {
    const r = i / count;
    if (r < rushRatio)                   roles.push('rusher');
    else if (r < rushRatio + flankRatio) roles.push('flanker');
    else                                 roles.push('sniper');
  }

  // shuffle so types are interleaved
  for (let i = roles.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [roles[i], roles[j]] = [roles[j], roles[i]];
  }
  return roles;
}
