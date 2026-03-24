/**
 * Enemy role configurations
 *
 * rusher    — fast, low HP, dashes straight to objective
 * flanker   — medium speed, circles around the friendly swarm
 * sniper    — slow, keeps distance, fires from long range
 * stealth   — invisible on radar until within 60px of a friendly drone
 * kamikaze  — doesn't shoot; charges directly and explodes on contact (×3.5 damage)
 * commander — stays behind formation, buffs nearby enemy fire damage by +20%
 */
export const ENEMY_ROLES = {
  rusher: {
    color: '#ff3c3c',
    shadowColor: '#ff3c3c',
    hp: 60, maxHp: 60,
    maxSpeed: 110,
    fireRange: 75, fireDamage: 20, fireRate: 1.1,
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
    hp: 80, maxHp: 80,
    maxSpeed: 80,
    fireRange: 105, fireDamage: 28, fireRate: 0.9,
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
    hp: 50, maxHp: 50,
    maxSpeed: 50,
    fireRange: 210, fireDamage: 42, fireRate: 1.8,
    boids: {
      separationRadius: 30, separationWeight: 1.8,
      alignmentRadius: 70,  alignmentWeight: 0.4,
      cohesionRadius: 70,   cohesionWeight: 0.3,
      seekWeight: 1.2, maxForce: 0.25, maxSpeed: 50,
    },
  },

  // ── New: Stealth ──────────────────────────────────────────────────────────
  stealth: {
    color: '#00cc44',           // bright when revealed
    shadowColor: '#00aa33',
    hp: 45, maxHp: 45,
    maxSpeed: 105,
    fireRange: 90, fireDamage: 22, fireRate: 0.85,
    boids: {
      separationRadius: 20, separationWeight: 1.2,
      alignmentRadius: 50,  alignmentWeight: 0.4,
      cohesionRadius: 50,   cohesionWeight: 0.3,
      seekWeight: 2.8, maxForce: 0.38, maxSpeed: 105,
    },
  },

  // ── New: Kamikaze ─────────────────────────────────────────────────────────
  kamikaze: {
    color: '#ff4400',
    shadowColor: '#ff2200',
    hp: 30, maxHp: 30,
    maxSpeed: 65,               // starts slow; accelerates dynamically in EnemySwarm.update()
    fireRange: 0,               // never shoots
    fireDamage: 0,
    fireRate: 999,              // effectively never fires
    boids: {                    // not used (kamikaze skips boid calc)
      separationRadius: 20, separationWeight: 1.0,
      alignmentRadius: 40,  alignmentWeight: 0.2,
      cohesionRadius: 40,   cohesionWeight: 0.2,
      seekWeight: 4.0, maxForce: 0.60, maxSpeed: 200,
    },
  },

  // ── New: Commander ────────────────────────────────────────────────────────
  commander: {
    color: '#ffaa00',
    shadowColor: '#ff8800',
    hp: 130, maxHp: 130,
    maxSpeed: 45,
    fireRange: 145, fireDamage: 35, fireRate: 1.6,
    auraRadius: 150,            // buff range (used in EnemySwarm.update)
    auraDamageBonus: 0.20,      // +20% fire damage to nearby enemies
    boids: {
      separationRadius: 40, separationWeight: 2.0,
      alignmentRadius: 80,  alignmentWeight: 0.5,
      cohesionRadius: 80,   cohesionWeight: 0.4,
      seekWeight: 1.0, maxForce: 0.20, maxSpeed: 45,
    },
  },
};

/** Boss — spawns once per boss wave (every 5th wave) */
export const BOSS_ROLE = {
  color: '#ffdd00',
  shadowColor: '#ffaa00',
  hp: 450, maxHp: 450,
  maxSpeed: 38,
  fireRange: 170, fireDamage: 55, fireRate: 2.2,
  scale: 2.8,
  boids: {
    separationRadius: 50, separationWeight: 2.0,
    alignmentRadius: 90,  alignmentWeight: 0.3,
    cohesionRadius: 90,   cohesionWeight: 0.2,
    seekWeight: 1.8, maxForce: 0.30, maxSpeed: 38,
  },
};

/**
 * Returns a scaled config for a role at a given wave.
 */
export function getScaledConfig(role, wave) {
  const base = { ...ENEMY_ROLES[role] };
  const tier = Math.floor((wave - 1) / 3);
  if (tier === 0) return base;

  const hpMult  = 1 + tier * 0.18;
  const spdMult = 1 + tier * 0.08;
  const dmgMult = 1 + tier * 0.10;

  return {
    ...base,
    hp:          Math.round(base.hp          * hpMult),
    maxHp:       Math.round(base.maxHp       * hpMult),
    maxSpeed:    Math.round(base.maxSpeed     * spdMult),
    fireDamage:  base.fireDamage > 0 ? Math.round(base.fireDamage * dmgMult) : 0,
    boids: { ...base.boids, maxSpeed: Math.round(base.boids.maxSpeed * spdMult) },
  };
}

/**
 * Returns an array of role names for a given wave.
 *   wave 1       → all rushers
 *   wave 2       → rushers + flankers
 *   wave 3       → +snipers  +stealth starts
 *   wave 4+      → +kamikaze introduced
 *   wave 6+      → full mix
 *
 * Commander is NOT in the composition — it is spawned separately by EnemySwarm.
 */
export function waveComposition(wave, count, roleWeights = null) {
  let rushR, flankR, snipeR, stealthR, kamiR;

  if (roleWeights) {
    const keys = ['rusher', 'flanker', 'sniper', 'stealth', 'kamikaze'];
    const total = keys.reduce((s, k) => s + (roleWeights[k] ?? 0), 0) || 1;
    rushR   = (roleWeights.rusher   ?? 0) / total;
    flankR  = (roleWeights.flanker  ?? 0) / total;
    snipeR  = (roleWeights.sniper   ?? 0) / total;
    stealthR = (roleWeights.stealth  ?? 0) / total;
    kamiR   = (roleWeights.kamikaze ?? 0) / total;
  } else if (wave <= 1) {
    [rushR, flankR, snipeR, stealthR, kamiR] = [1.00, 0.00, 0.00, 0.00, 0.00];
  } else if (wave <= 2) {
    [rushR, flankR, snipeR, stealthR, kamiR] = [0.70, 0.30, 0.00, 0.00, 0.00];
  } else if (wave <= 3) {
    [rushR, flankR, snipeR, stealthR, kamiR] = [0.50, 0.28, 0.12, 0.10, 0.00];
  } else if (wave <= 5) {
    [rushR, flankR, snipeR, stealthR, kamiR] = [0.35, 0.28, 0.15, 0.10, 0.12];
  } else {
    [rushR, flankR, snipeR, stealthR, kamiR] = [0.25, 0.26, 0.18, 0.14, 0.17];
  }

  const roles = [];
  for (let i = 0; i < count; i++) {
    const r = i / count;
    let cum = 0;
    if (r < (cum += rushR))   { roles.push('rusher');   continue; }
    if (r < (cum += flankR))  { roles.push('flanker');  continue; }
    if (r < (cum += snipeR))  { roles.push('sniper');   continue; }
    if (r < (cum += stealthR)){ roles.push('stealth');  continue; }
    roles.push('kamikaze');
  }

  // Shuffle so types are interleaved
  for (let i = roles.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [roles[i], roles[j]] = [roles[j], roles[i]];
  }
  return roles;
}
