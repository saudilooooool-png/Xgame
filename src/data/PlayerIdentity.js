/**
 * PlayerIdentity — stores all per-player customization:
 *   teamColor   : glow color of the player's drones + radar blips
 *   radarShape  : blip shape on the radar (circle / diamond / triangle / cross)
 *   callsign    : player tag shown in HUD
 *   blueprint   : three tradeoff sliders (0–1) that modify drone stats
 */

export const TEAM_COLORS = [
  { name: 'Cyan',   color: '#00d4ff', shadow: '#0088bb' },
  { name: 'Green',  color: '#00ff88', shadow: '#007744' },
  { name: 'Purple', color: '#cc66ff', shadow: '#882299' },
  { name: 'Orange', color: '#ff8844', shadow: '#994422' },
  { name: 'Gold',   color: '#ffcc00', shadow: '#997700' },
  { name: 'White',  color: '#e8f4ff', shadow: '#8899aa' },
];

export const RADAR_SHAPES = [
  { id: 'circle',   label: '●', hint: 'دائرة' },
  { id: 'diamond',  label: '◆', hint: 'معين' },
  { id: 'triangle', label: '▲', hint: 'مثلث' },
  { id: 'cross',    label: '✚', hint: 'صليب' },
];

/** Returns a fresh default identity (Cyan / circle / balanced). */
export function defaultIdentity() {
  return {
    callsign:   'ALPHA',
    teamColor:  '#00d4ff',
    teamShadow: '#0088bb',
    radarShape: 'circle',
    blueprint: {
      speedArmor:      0.5,   // 0 = glass cannon (speed), 1 = tank (armor)
      damageFireRate:  0.5,   // 0 = heavy damage / slow, 1 = rapid fire / weak
      rangeAggression: 0.5,   // 0 = long-range sniper, 1 = aggressive brawler
    },
  };
}

// ── Stat multipliers from blueprint values ─────────────────────────────────
// Each value is 0–1; 0.5 = balanced baseline.

export function blueprintMultipliers(bp) {
  const sa  = bp.speedArmor      ?? 0.5;
  const dfr = bp.damageFireRate  ?? 0.5;
  const ra  = bp.rangeAggression ?? 0.5;

  return {
    speed:     1 + (0.5 - sa)  * 0.8,   // 0.6 → 1.4
    armor:     1 + (sa  - 0.5) * 0.8,   // 0.6 → 1.4
    damage:    1 + (0.5 - dfr) * 0.8,   // 0.6 → 1.4
    fireRate:  1 + (dfr - 0.5) * 0.8,   // 0.6 → 1.4  (lower = faster shooting)
    range:     1 + (0.5 - ra)  * 1.0,   // 0.5 → 1.5
    aggrSpeed: ra > 0.5 ? 1 + (ra - 0.5) * 0.4 : 1,  // aggression adds +speed
  };
}

// ── Veteran callsign generator ─────────────────────────────────────────────
const _NATO = ['Alpha','Bravo','Charlie','Delta','Echo',
               'Foxtrot','Ghost','Hawk','Iron','Jade',
               'Kilo','Lima','Mercury','Nova','Omega'];
let _vetIdx = 0;

export function nextVetCallsign() {
  const idx = _vetIdx++;
  return `${_NATO[idx % _NATO.length]}-${Math.floor(idx / _NATO.length) + 1}`;
}
