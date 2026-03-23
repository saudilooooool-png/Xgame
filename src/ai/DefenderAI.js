/**
 * DefenderAI — infers attacker's plan from observable loadout signals.
 *
 * The defender CANNOT see:
 *   - Which target was chosen
 *   - The approach direction
 *
 * The defender CAN see (before mission starts):
 *   - Total drone count
 *   - Ratio of each drone type (composition signals intent)
 *
 * Output: a DefenseProfile used by EnemySwarm to adjust spawn edge,
 * enemy composition, and wave size.
 */

import { TARGET_LIST } from '../entities/TargetTypes.js';

const APPROACHES = ['top', 'right', 'bottom', 'left'];

/**
 * Build a defender inference from the player's loadout.
 * @param {{ standard:number, interceptor:number, gunship:number, sentinel:number }} loadout
 * @param {string} realTargetId   - kept secret; used only at end to score the defender
 * @param {string} realApproach   - kept secret; used only to compute surprise bonus
 * @returns {DefenseProfile}
 */
export function buildDefenseProfile(loadout, realTargetId, realApproach) {
  const total = loadout.standard + loadout.interceptor + loadout.gunship + loadout.sentinel;
  if (total === 0) total = 1;

  const ratioFast   = (loadout.interceptor) / total;         // speed → mobile strike
  const ratioHeavy  = (loadout.gunship)     / total;         // power → brute force
  const ratioTanky  = (loadout.sentinel)    / total;         // range → siege

  // ── Infer likely target ─────────────────────────────────────────────────
  // Score each target based on how well the loadout signals match
  const scores = {
    military:  ratioHeavy * 3 + ratioFast  * 1,
    energy:    ratioTanky * 3 + ratioHeavy * 1,
    comms:     ratioFast  * 3 + ratioTanky * 1,
    civilian:  (1 - ratioFast - ratioHeavy - ratioTanky) * 2 + 0.5, // balanced → guess civilian
  };

  // Add noise so the defender isn't perfect
  for (const k of Object.keys(scores)) {
    scores[k] += Math.random() * 1.2;
  }

  const guessedTargetId = Object.entries(scores)
    .sort((a, b) => b[1] - a[1])[0][0];

  // ── Infer likely approach direction ────────────────────────────────────
  // Defender guesses randomly with slight bias from drone speed
  // (fast loadout → they'll come from far edges; slow → center approach)
  const approachWeights = { top: 1, right: 1, bottom: 1, left: 1 };
  if (ratioFast > 0.3)  { approachWeights.top *= 1.8; approachWeights.bottom *= 1.4; }
  if (ratioTanky > 0.3) { approachWeights.left *= 1.5; approachWeights.right *= 1.5; }

  const totalW = Object.values(approachWeights).reduce((s, v) => s + v, 0);
  let r = Math.random() * totalW;
  let guessedApproach = 'top';
  for (const [dir, w] of Object.entries(approachWeights)) {
    r -= w;
    if (r <= 0) { guessedApproach = dir; break; }
  }

  // ── Accuracy flags ──────────────────────────────────────────────────────
  const targetCorrect   = guessedTargetId === realTargetId;
  const approachCorrect = guessedApproach  === realApproach;

  // ── Build defense strategy based on guess ──────────────────────────────
  const guessedTarget = TARGET_LIST.find(t => t.id === guessedTargetId);
  const strategy = _strategyFor(guessedTarget?.defenderHint ?? 'heavy',
                                targetCorrect, approachCorrect);

  return {
    guessedTargetId,
    guessedApproach,
    targetCorrect,
    approachCorrect,
    strategy,          // passed to EnemySwarm
    // Surprise bonus for attacker if defender was wrong
    surpriseBonus: (!targetCorrect ? 0.4 : 0) + (!approachCorrect ? 0.3 : 0),
  };
}

/**
 * Map defender hint → enemy swarm strategy.
 * Correct guesses → stronger, better-positioned defense.
 */
function _strategyFor(hint, targetCorrect, approachCorrect) {
  // Base modifiers
  const sizeMulti  = targetCorrect   ? 1.35 : 0.80;  // more enemies if correct
  const edgeBias   = approachCorrect ? 0.80 : null;   // null = random edges

  switch (hint) {
    case 'heavy':
      return {
        name: 'heavy',
        sizeMulti,
        edgeBias,
        roleWeights: targetCorrect
          ? { rusher: 2, flanker: 2, sniper: 1 }   // counter: spread attack
          : { rusher: 3, flanker: 1, sniper: 0 },
      };
    case 'perimeter':
      return {
        name: 'perimeter',
        sizeMulti,
        edgeBias,
        roleWeights: targetCorrect
          ? { rusher: 1, flanker: 3, sniper: 1 }   // surround
          : { rusher: 2, flanker: 1, sniper: 1 },
      };
    case 'mobile':
      return {
        name: 'mobile',
        sizeMulti,
        edgeBias,
        roleWeights: targetCorrect
          ? { rusher: 2, flanker: 1, sniper: 2 }   // intercept at range
          : { rusher: 2, flanker: 1, sniper: 1 },
      };
    case 'scattered':
    default:
      return {
        name: 'scattered',
        sizeMulti,
        edgeBias: null,                            // always random when scattered
        roleWeights: { rusher: 2, flanker: 1, sniper: 1 },
      };
  }
}
