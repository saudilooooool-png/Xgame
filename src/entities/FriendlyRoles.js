/**
 * Friendly drone role configurations
 *
 * standard    — balanced, the default unit
 * interceptor — fast, light, hunts rushers
 * gunship     — heavy hitter, good vs bosses & flankers
 * sentinel    — tank, long-range guard
 */
export const FRIENDLY_ROLES = {
  standard: {
    color: '#00d4ff',
    shadowColor: '#00d4ff',
    hp: 100, maxHp: 100,
    maxSpeed: 130,
    fireRange: 130, fireDamage: 40, fireRate: 0.65,
    boids: {
      separationRadius: 28, separationWeight: 2.0,
      alignmentRadius:  70, alignmentWeight:  0.8,
      cohesionRadius:   70, cohesionWeight:   0.6,
      seekWeight: 2.0, maxForce: 0.50, maxSpeed: 130,
    },
  },

  interceptor: {
    color: '#44ffcc',
    shadowColor: '#00ffaa',
    hp: 75, maxHp: 75,
    maxSpeed: 170,
    fireRange: 105, fireDamage: 28, fireRate: 0.48,
    boids: {
      separationRadius: 22, separationWeight: 2.2,
      alignmentRadius:  55, alignmentWeight:  1.0,
      cohesionRadius:   55, cohesionWeight:   0.4,
      seekWeight: 2.8, maxForce: 0.65, maxSpeed: 170,
    },
  },

  gunship: {
    color: '#ffaa00',
    shadowColor: '#ff8800',
    hp: 130, maxHp: 130,
    maxSpeed: 88,
    fireRange: 150, fireDamage: 58, fireRate: 0.90,
    boids: {
      separationRadius: 34, separationWeight: 1.8,
      alignmentRadius:  80, alignmentWeight:  0.7,
      cohesionRadius:   80, cohesionWeight:   0.5,
      seekWeight: 1.8, maxForce: 0.38, maxSpeed: 88,
    },
  },

  sentinel: {
    color: '#88ff44',
    shadowColor: '#55cc22',
    hp: 165, maxHp: 165,
    maxSpeed: 58,
    fireRange: 195, fireDamage: 24, fireRate: 1.15,
    boids: {
      separationRadius: 40, separationWeight: 1.5,
      alignmentRadius:  90, alignmentWeight:  0.5,
      cohesionRadius:   90, cohesionWeight:   0.4,
      seekWeight: 1.4, maxForce: 0.28, maxSpeed: 58,
    },
  },
};

/** UI metadata for UpgradeScreen */
export const ROLE_DISPLAY = {
  interceptor: {
    icon: '▲▲',
    label: 'INTERCEPTOR ×2',
    desc: 'Fast & light — hunts Rushers\n75 HP | 170 SPD | 28 DMG',
    color: '#44ffcc',
  },
  gunship: {
    icon: '◆',
    label: 'GUNSHIP ×2',
    desc: 'Heavy hitter — counters Bosses\n130 HP | 88 SPD | 58 DMG',
    color: '#ffaa00',
  },
  sentinel: {
    icon: '⬡',
    label: 'SENTINEL ×2',
    desc: 'Tank guard — long-range hold\n165 HP | 58 SPD | 24 DMG',
    color: '#88ff44',
  },
};
