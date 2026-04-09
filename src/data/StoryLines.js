/**
 * StoryLines — narrative data for each wave.
 * Each wave entry has:
 *   arTitle : short Arabic chapter title
 *   enTitle : short English chapter title
 *   sub     : Arabic descriptive subtitle
 *   color   : accent color for the announcement
 *
 * getWaveStory() also injects dynamic state context (critical resources, streak).
 */

const WAVE_STORIES = {
  1:  {
    arTitle: 'الساعة الصفر',
    enTitle: 'ZERO HOUR',
    sub: 'الأعداء يقتربون من محطة الكهرباء — احمِها بكل ما لديك',
    color: '#00d4ff',
  },
  2:  {
    arTitle: 'موجة ثانية',
    enTitle: 'SECOND WAVE',
    sub: 'قوات احتياطية تتجمع على الحدود الشمالية',
    color: '#00d4ff',
  },
  3:  {
    arTitle: 'تهديد مزدوج',
    enTitle: 'DUAL THREAT',
    sub: 'رصدنا حركة نحو شبكة المياه — تقسيم الأسراب ضروري',
    color: '#00aaff',
  },
  4:  {
    arTitle: 'الحصار يضيق',
    enTitle: 'SIEGE TIGHTENS',
    sub: 'الأسراب أكبر وأذكى — التشكيل سيحدد مصير المعركة',
    color: '#00aaff',
  },
  6:  {
    arTitle: 'ثأر الأسراب',
    enTitle: 'SWARM RETRIBUTION',
    sub: 'الأعداء يستهدفون الموارد الثلاثة في وقت واحد',
    color: '#ffaa00',
  },
  7:  {
    arTitle: 'حرب الموارد',
    enTitle: 'RESOURCE WAR',
    sub: 'بدأ الهجوم على مخازن الغذاء — كل مورد في خطر الآن',
    color: '#ffaa00',
  },
  8:  {
    arTitle: 'ليلة الحصار',
    enTitle: 'SIEGE NIGHT',
    sub: 'الأسراب تضرب من كل الجهات — لا هوادة',
    color: '#ff8844',
  },
  9:  {
    arTitle: 'آخر فرصة',
    enTitle: 'LAST CHANCE',
    sub: 'الغارة الكبرى قادمة — عزّز مواقعك الآن',
    color: '#ff6622',
  },
  11: {
    arTitle: 'لا نهاية للحصار',
    enTitle: 'ENDLESS SIEGE',
    sub: 'الأعداء يتعلمون من كل موجة — هل ستصمد؟',
    color: '#cc88ff',
  },
  12: {
    arTitle: 'رماة الظلام',
    enTitle: 'SHADOW SNIPERS',
    sub: 'قناصة تسيطر على ساحة المعركة من بعيد — استخدم تشكيل الخنجر',
    color: '#cc44ff',
  },
  13: {
    arTitle: 'صمت قبل العاصفة',
    enTitle: 'EYE OF THE STORM',
    sub: 'هجوم خفيف — لكن لا تستهن، القادم أشد',
    color: '#44aaff',
  },
  14: {
    arTitle: 'ظل الليل',
    enTitle: 'SHADOW LEGION',
    sub: 'وحدات التخفي تحيط بالمدينة — نبضة التركيز ستكشفهم',
    color: '#00cc88',
  },
  15: {
    arTitle: 'الأسطورة',
    enTitle: 'LEGEND',
    sub: 'لم يتوقع المدافعون أن تصل حتى هنا — استمر',
    color: '#cc88ff',
  },
  16: {
    arTitle: 'موجة الانتحاريين',
    enTitle: 'MARTYRS WAVE',
    sub: 'المتفجرون يندفعون — لا تدعهم يقتربون من المدن',
    color: '#ff4400',
  },
  17: {
    arTitle: 'طوفان الحديد',
    enTitle: 'IRON FLOOD',
    sub: 'العدد كثيف — وزّع السرب على عدة محاور دفاعية',
    color: '#ff6622',
  },
  18: {
    arTitle: 'لحظة استعادة',
    enTitle: 'RECOVERY',
    sub: 'استغل هذه اللحظة — أعد تشكيل وعالج الأهداف',
    color: '#44aaff',
  },
  19: {
    arTitle: 'النخبة الأخيرة',
    enTitle: 'FINAL ELITE',
    sub: 'أفضل وحدات العدو تتقدم — لا هامش للخطأ',
    color: '#ffaa00',
  },
  20: {
    arTitle: 'نهاية الدنيا',
    enTitle: 'APOCALYPSE',
    sub: 'المدينة الأخيرة تقاوم — تاريخ يُصنع الآن',
    color: '#ff4444',
  },
};

// Boss waves have their own dramatic text
const BOSS_STORIES = {
  5:  {
    arTitle: 'ظهور القائد',
    enTitle: 'COMMANDER ARRIVES',
    sub: 'وحدة ثقيلة تقود الاندفاع — الهيكل السداسي لا يرحم',
    color: '#ffcc00',
  },
  10: {
    arTitle: 'الضربة الكبرى',
    enTitle: 'THE BIG STRIKE',
    sub: 'القائد الثاني يصل — هذا ليس مجرد هجوم',
    color: '#ffcc00',
  },
  15: {
    arTitle: 'قيامة الحديد',
    enTitle: 'IRON APOCALYPSE',
    sub: 'وحدة قيادية فائقة — ابق هادئاً وثبّت الدفاعات',
    color: '#ff8800',
  },
};

/**
 * Dynamic suffixes appended when resources are in critical state.
 * Returns an array of up to 2 urgent lines.
 */
function criticalLines(cityResources) {
  const lines = [];
  if (cityResources.power <= 20)  lines.push('⚡ الظلام على وشك السقوط');
  if (cityResources.water <= 20)  lines.push('💧 العطش يدق الأبواب');
  if (cityResources.food  <= 20)  lines.push('🌾 الجوع يُضعف طائراتك');
  return lines.slice(0, 2);
}

/**
 * Returns the story object for a given wave.
 * @param {number} wave
 * @param {boolean} isBossWave
 * @param {CityResources} cityResources
 * @param {number} streak
 * @param {string} [archetypeAr] — Arabic archetype label (optional)
 * @returns {{ arTitle, enTitle, sub, color, urgentLines, streakBonus, archetypeAr }}
 */
export function getWaveStory(wave, isBossWave, cityResources, streak = 0, archetypeAr = '') {
  let story;

  if (isBossWave) {
    story = BOSS_STORIES[wave] ?? {
      arTitle: 'قائد الهجوم',
      enTitle: 'ATTACK COMMANDER',
      sub: 'وحدة ثقيلة تقود الاندفاع',
      color: '#ffcc00',
    };
  } else {
    const keys = Object.keys(WAVE_STORIES)
      .map(Number)
      .filter(k => k <= wave)
      .sort((a, b) => b - a);
    const key = keys[0] ?? 1;
    story = WAVE_STORIES[key];
  }

  const urgentLines = criticalLines(cityResources);

  // Streak bonus label
  const streakBonus = streak >= 2
    ? `🔥 سلسلة ×${streak} موجة مثالية!`
    : null;

  return { ...story, urgentLines, streakBonus, archetypeAr };

// ── Achievement definitions ─────────────────────────────────────────────────

export const ACHIEVEMENTS = [
  {
    id: 'survivor_10',
    icon: '🏆',
    label: 'عشر موجات',
    desc: 'أكمل ١٠ موجات',
    check: (s) => s.wave >= 10,
  },
  {
    id: 'survivor_15',
    icon: '🌟',
    label: 'مدافع أسطوري',
    desc: 'أكمل ١٥ موجة',
    check: (s) => s.wave >= 15,
  },
  {
    id: 'clean_streak',
    icon: '🔥',
    label: 'سلسلة لا تتوقف',
    desc: '٣ موجات مثالية متتالية',
    check: (s) => s.maxStreak >= 3,
  },
  {
    id: 'boss_slayer',
    icon: '💀',
    label: 'قاتل القادة',
    desc: 'أوقف موجة بوس كاملة',
    check: (s) => s.bossWavesCleared >= 1,
  },
  {
    id: 'triple_boss',
    icon: '👑',
    label: 'صائد القادة',
    desc: 'أوقف ٣ موجات بوس',
    check: (s) => s.bossWavesCleared >= 3,
  },
  {
    id: 'last_stand',
    icon: '⚔',
    label: 'الصمود الأخير',
    desc: 'خسرت مورد وصمدت موجة أخرى',
    check: (s) => s.objectivesAlive <= 2 && s.wave >= 3,
  },
  {
    id: 'protector',
    icon: '🛡',
    label: 'حامي الموارد',
    desc: 'جميع الموارد > ٥٠٪ في الموجة ٥',
    check: (s) => s.wave >= 5 && s.resources.power > 50
              && s.resources.water > 50 && s.resources.food > 50,
  },
  {
    id: 'slaughter',
    icon: '⬡',
    label: 'أسراب الموت',
    desc: 'دمّر ٥٠ طائرة عدوة',
    check: (s) => s.totalKills >= 50,
  },
];

/**
 * Returns array of earned achievement objects for end-of-game stats.
 */
export function checkAchievements(stats) {
  return ACHIEVEMENTS.filter(a => a.check(stats));
}
