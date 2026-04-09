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
  hp: 700, maxHp: 700,        // ×1.55 vs old 450
  maxSpeed: 52,               // ×1.37 vs old 38
  fireRange: 200, fireDamage: 70, fireRate: 1.8,   // was 170 / 55 / 2.2
  scale: 3.2,                 // was 2.8
  // Enrage threshold — applied in EnemySwarm when hp drops to ≤ 40%
  enrageAt: 0.40,
  boids: {
    separationRadius: 55, separationWeight: 2.2,
    alignmentRadius:  100, alignmentWeight: 0.3,
    cohesionRadius:   100, cohesionWeight:  0.2,
    seekWeight: 2.2, maxForce: 0.38, maxSpeed: 52,
  },
};

/**
 * Returns a scaled config for a role at a given wave.
 * Scaling is now continuous (per-wave) rather than coarse 3-wave tiers.
 */
export function getScaledConfig(role, wave) {
  const base = { ...ENEMY_ROLES[role] };
  if (wave <= 1) return base;

  // Continuous scaling: +6% HP/wave, +2.5% speed/wave, +3% damage/wave
  // Capped at wave 15 (no further scaling beyond that)
  const w      = Math.min(wave - 1, 14);
  const hpMult  = 1 + w * 0.060;
  const spdMult = 1 + w * 0.025;
  const dmgMult = 1 + w * 0.030;

  return {
    ...base,
    hp:         Math.round(base.hp         * hpMult),
    maxHp:      Math.round(base.maxHp      * hpMult),
    maxSpeed:   Math.round(base.maxSpeed   * spdMult),
    fireDamage: base.fireDamage > 0 ? Math.round(base.fireDamage * dmgMult) : 0,
    boids: { ...base.boids, maxSpeed: Math.round(base.boids.maxSpeed * spdMult) },
  };
}

// ── Wave Archetypes ───────────────────────────────────────────────────────────
// Each archetype defines the feel of a non-boss wave:
//   sizeScale  — multiplier on base enemy count
//   ar         — Arabic alert name shown to player
//   weights    — role ratio override (null = use waveComposition defaults)

export const WAVE_ARCHETYPES = {
  standard:  { sizeScale: 1.00, ar: '',                  weights: null },
  swarm:     { sizeScale: 1.40, ar: '🌊 غارة سرب!',      weights: { rusher: 75, flanker: 20, sniper: 0,  stealth: 0,  kamikaze: 5  } },
  elite:     { sizeScale: 0.60, ar: '⚔ نخبة متمرّسة',    weights: { rusher: 15, flanker: 25, sniper: 35, stealth: 15, kamikaze: 10 } },
  stealth:   { sizeScale: 0.85, ar: '👁 تسلل خفي',       weights: { rusher: 10, flanker: 15, sniper: 10, stealth: 55, kamikaze: 10 } },
  kamikaze:  { sizeScale: 1.10, ar: '💥 هجوم انتحاري',   weights: { rusher: 20, flanker: 10, sniper: 5,  stealth: 5,  kamikaze: 60 } },
  blitz:     { sizeScale: 1.45, ar: '⚡ بليتز!',          weights: { rusher: 40, flanker: 30, sniper: 5,  stealth: 0,  kamikaze: 25 } },
  siege:     { sizeScale: 0.75, ar: '🎯 حصار مدفعي',     weights: { rusher: 10, flanker: 10, sniper: 60, stealth: 15, kamikaze: 5  } },
  rest:      { sizeScale: 0.50, ar: '😮‍💨 تهدئة مؤقتة', weights: { rusher: 80, flanker: 15, sniper: 5,  stealth: 0,  kamikaze: 0  } },
};

/**
 * Returns the archetype key for a given wave.
 * Boss waves (wave % 5 === 0) always return 'boss'.
 * The sequence alternates between intense and calm for clear rhythm.
 */
export function getWaveArchetype(wave) {
  if (wave % 5 === 0) return 'boss';

  // Hand-crafted sequence for waves 1–20 — after that, repeat a cycle
  const SEQ = [
    null,        // wave 0 (unused)
    'standard',  // wave 1  — tutorial, easy start
    'swarm',     // wave 2  — lots of rushers
    'standard',  // wave 3  — mixed, dual-front introduction
    'elite',     // wave 4  — fewer but tougher
    // wave 5 = boss
    'swarm',     // wave 6  — big wave return after boss
    'stealth',   // wave 7  — sneaky assault
    'rest',      // wave 8  — breathing room
    'kamikaze',  // wave 9  — dangerous close-range
    // wave 10 = boss
    'blitz',     // wave 11 — overwhelming numbers
    'siege',     // wave 12 — long-range snipers dominate
    'rest',      // wave 13 — calm before storm
    'stealth',   // wave 14 — heavy stealth
    // wave 15 = boss
    'kamikaze',  // wave 16 — chaotic
    'blitz',     // wave 17 — massive push
    'rest',      // wave 18 — short rest
    'elite',     // wave 19 — elite before mega-boss
    // wave 20 = boss
  ];

  if (wave < SEQ.length && SEQ[wave]) return SEQ[wave];

  // Waves 21+: repeat a 4-wave cycle (no more rests — players are veterans)
  const cycle = ['blitz', 'siege', 'elite', 'kamikaze'];
  // Map wave to non-boss index
  let nonBossIdx = 0;
  for (let w = 21; w < wave; w++) {
    if (w % 5 !== 0) nonBossIdx++;
  }
  return cycle[nonBossIdx % cycle.length];
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
  } else if (wave <= 8) {
    [rushR, flankR, snipeR, stealthR, kamiR] = [0.25, 0.26, 0.18, 0.14, 0.17];
  } else if (wave <= 12) {
    [rushR, flankR, snipeR, stealthR, kamiR] = [0.20, 0.22, 0.20, 0.18, 0.20];
  } else if (wave <= 16) {
    [rushR, flankR, snipeR, stealthR, kamiR] = [0.15, 0.20, 0.22, 0.22, 0.21];
  } else {
    [rushR, flankR, snipeR, stealthR, kamiR] = [0.12, 0.18, 0.24, 0.24, 0.22];
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
