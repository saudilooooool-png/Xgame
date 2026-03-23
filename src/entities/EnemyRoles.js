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

/**
 * Returns an array of role names for a given wave number.
 * wave 1   → all rushers
 * wave 2   → rushers + flankers
 * wave 3+  → rushers + flankers + snipers
 * wave 5+  → heavier mix; every 5th wave is a "boss" wave with extra enemies
 */
export function waveComposition(wave, count) {
  let rushRatio, flankRatio, snipeRatio;

  if (wave === 1) {
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
