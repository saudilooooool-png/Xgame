/**
 * Target type definitions.
 * Each target has different HP, score multiplier, visual style,
 * and hints that influence defender AI inference.
 */
export const TARGET_TYPES = {
  military: {
    id: 'military',
    label: 'قاعدة عسكرية',
    icon: '🎯',
    color: '#ff4444',
    shadowColor: '#ff0000',
    hp: 80,
    scoreMulti: 2.0,
    desc: 'دفاع ثقيل — مكافأة عالية',
    defenderHint: 'heavy',     // defender expects brute-force assault
  },
  energy: {
    id: 'energy',
    label: 'منشأة طاقة',
    icon: '⚡',
    color: '#ffcc00',
    shadowColor: '#ff8800',
    hp: 130,
    scoreMulti: 1.5,
    desc: 'دفاع متوسط — حياة أعلى للهدف',
    defenderHint: 'perimeter',  // defender patrols the edges
  },
  comms: {
    id: 'comms',
    label: 'مركز اتصالات',
    icon: '📡',
    color: '#cc88ff',
    shadowColor: '#9900ff',
    hp: 100,
    scoreMulti: 1.8,
    desc: 'دفاع خفيف سريع — يُبطئ الأعداء عند الاختراق',
    defenderHint: 'mobile',    // defender uses fast interceptors
  },
  civilian: {
    id: 'civilian',
    label: 'بنية مدنية',
    icon: '🏙',
    color: '#00ff88',
    shadowColor: '#00cc66',
    hp: 160,
    scoreMulti: 1.0,
    desc: 'دفاع ضعيف — أقل خطورة لكن ثواب أقل',
    defenderHint: 'scattered',  // defender spreads thin
  },
};

export const TARGET_LIST = Object.values(TARGET_TYPES);
