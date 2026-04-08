/**
 * Locale — Arabic-first i18n module.
 *
 * Default language: Arabic (ar).
 * Persisted to localStorage under key 'xgame_lang'.
 *
 * Usage:
 *   import { t, setLang, getLang, onLangChange } from '../data/Locale.js';
 *   t('section.objectives')            → "الأهداف"  | "OBJECTIVES"
 *   t('phase.combat', {wave:2, n:8})   → "⚔ موجة 2 — 8 متبقين"
 */

// ── String table ─────────────────────────────────────────────────────────────

const STRINGS = {

  ar: {
    // ── Panel / section headers ──────────────────────────────────────────
    'panel.cmd_intel':        '▣ ذكاء القيادة',
    'section.objectives':     'الأهداف',
    'section.command_web':    'شبكة القيادة',
    'section.threat_grid':    'شبكة التهديد',
    'section.formation':      'التشكيل',
    'section.sonar':          'السونار',
    'section.emp':            'النبضة EMP',
    'section.footer':         '',

    // ── Top bar ──────────────────────────────────────────────────────────
    'mission.defend':         'الدفاع عن شبكة المدينة',

    // ── Commander danger ──────────────────────────────────────────────────
    'danger.active_ar':       'القائد في الميدان',
    'danger.active_en':       'القائد نشط',

    // ── CMD HP ───────────────────────────────────────────────────────────
    'cmd.hp_label':           '★ صحة القائد',

    // ── Footer stats ──────────────────────────────────────────────────────
    'stat.kills':             '⬡',
    'stat.losses':            '✗',
    'stat.score_suffix':      'نقطة',

    // ── Formation names ───────────────────────────────────────────────────
    'f.watch':                'وتش',
    'f.dagger':               'خنجر',
    'f.shield':               'درع',
    'f.net':                  'شبكة',
    'f.point':                'نقطة',

    // ── Formation hints ───────────────────────────────────────────────────
    'fhint.watch':            'دورية متوازنة — مناسب للدفاع العام',
    'fhint.dagger':           'هجوم مركّز — يخترق الخطوط السريع',
    'fhint.shield':           'قوس دفاعي — يحمي المدن من الجانبين',
    'fhint.net':              'تطويق واسع — يُحاصر الأعداء في المنتصف',
    'fhint.point':            'كتلة كثيفة — يكشف المتخفّين بالتركيز',

    // ── Placement bar ─────────────────────────────────────────────────────
    'placement.cancel':       '[Escape / ضغطة ثانية للإلغاء]',

    // ── Radar ─────────────────────────────────────────────────────────────
    'radar.type':             'رادار مكاني',

    // ── Phase bar ─────────────────────────────────────────────────────────
    'phase.ready':            'جاهز',
    'phase.deploy':           '📍 نشر القوات  {time}s — Space للبدء',
    'phase.countdown':        '⚠ القتال في  {time}',
    'phase.cleared':          '✓ الموجة {wave} مُنظَّفة',
    'phase.combat':           '⚔ موجة {wave} — {n} متبقين',
    'phase.wave':             'موجة {wave}',

    // ── Tutorial ──────────────────────────────────────────────────────────
    'tut.title':              '⬡ كيف تلعب',
    'tut.main_hint':          '🖱 حرّك الفأرة / إصبعك → السرب يتبع ويهاجم تلقائياً',
    'tut.watch':              'وتش — دورية متوازنة (دفاعي)',
    'tut.dagger':             'خنجر — هجوم مركّز، يخترق الصفوف',
    'tut.shield':             'درع — قوس دفاعي يحمي المدن',
    'tut.net':                'شبكة — تطويق واسع يُحاصر الأعداء',
    'tut.point':              'نقطة — كتلة كثيفة، يكشف المتخفّين',
    'tut.group':              'تبديل بين المجموعات A→B→C→D',
    'tut.split':              'تقسيم / دمج الأسراب حسب الدور',
    'tut.emp_tower':          'وضع فخ EMP  ·  بناء برج Gatling',
    'tut.dismiss':            '▶ ابدأ — انقر أي مكان للإغلاق',

    // ── Alert messages ────────────────────────────────────────────────────
    'alert.attack':           '⚔ الهجوم!',
    'alert.deploy':           '📍 وزّع قواتك — Space للبدء',
    'alert.formation':        '⬡ تشكيل: {name}',

    // ── Mobile controls ───────────────────────────────────────────────────
    'mc.long_press_hint':     '⟲ اضغط مطوّلاً لفتح قائمة الأوامر',
    'mc.group':               'مجموعة',
    'mc.split':               'تقسيم',

    // ── Language toggle ───────────────────────────────────────────────────
    'lang.toggle':            'EN',
    'lang.toggle_title':      'Switch to English',
  },

  en: {
    // ── Panel / section headers ──────────────────────────────────────────
    'panel.cmd_intel':        '▣ CMD INTEL',
    'section.objectives':     'OBJECTIVES',
    'section.command_web':    'COMMAND WEB',
    'section.threat_grid':    'THREAT GRID',
    'section.formation':      'FORMATION',
    'section.sonar':          'SONAR',
    'section.emp':            'EMP',
    'section.footer':         '',

    // ── Top bar ──────────────────────────────────────────────────────────
    'mission.defend':         'DEFEND CITY GRID',

    // ── Commander danger ──────────────────────────────────────────────────
    'danger.active_ar':       'Commander in field',
    'danger.active_en':       'COMMANDER ACTIVE',

    // ── CMD HP ───────────────────────────────────────────────────────────
    'cmd.hp_label':           '★ CMD HP',

    // ── Footer stats ──────────────────────────────────────────────────────
    'stat.kills':             '⬡',
    'stat.losses':            '✗',
    'stat.score_suffix':      'pts',

    // ── Formation names ───────────────────────────────────────────────────
    'f.watch':                'WATCH',
    'f.dagger':               'DAGGER',
    'f.shield':               'SHIELD',
    'f.net':                  'NET',
    'f.point':                'POINT',

    // ── Formation hints ───────────────────────────────────────────────────
    'fhint.watch':            'Balanced patrol — good for general defence',
    'fhint.dagger':           'Focused attack — pierces enemy lines fast',
    'fhint.shield':           'Defensive arc — guards cities from flanks',
    'fhint.net':              'Wide encirclement — traps enemies in the middle',
    'fhint.point':            'Dense mass — reveals stealth by concentration',

    // ── Placement bar ─────────────────────────────────────────────────────
    'placement.cancel':       '[Escape / Double-tap to cancel]',

    // ── Radar ─────────────────────────────────────────────────────────────
    'radar.type':             'Spatial Radar',

    // ── Phase bar ─────────────────────────────────────────────────────────
    'phase.ready':            'READY',
    'phase.deploy':           '📍 DEPLOYMENT  {time}s — SPACE to skip',
    'phase.countdown':        '⚠ COMBAT IN  {time}',
    'phase.cleared':          '✓ WAVE {wave} CLEARED',
    'phase.combat':           '⚔ WAVE {wave} COMBAT — {n} remaining',
    'phase.wave':             'WAVE {wave}',

    // ── Tutorial ──────────────────────────────────────────────────────────
    'tut.title':              '⬡ HOW TO PLAY',
    'tut.main_hint':          '🖱 Move mouse / finger → Swarm follows and fires automatically',
    'tut.watch':              'WATCH — Balanced patrol (defensive)',
    'tut.dagger':             'DAGGER — Focused attack, pierces enemy lines',
    'tut.shield':             'SHIELD — Defensive arc protects cities',
    'tut.net':                'NET — Wide encirclement traps enemies',
    'tut.point':              'POINT — Dense mass, reveals stealth units',
    'tut.group':              'Switch between groups A→B→C→D',
    'tut.split':              'Split / merge swarms by role',
    'tut.emp_tower':          'Place EMP trap  ·  Build Gatling tower',
    'tut.dismiss':            '▶ START — Click anywhere to close',

    // ── Alert messages ────────────────────────────────────────────────────
    'alert.attack':           '⚔ ATTACK!',
    'alert.deploy':           '📍 Deploy forces — Space to start',
    'alert.formation':        '⬡ Formation: {name}',

    // ── Mobile controls ───────────────────────────────────────────────────
    'mc.long_press_hint':     '⟲ Long-press to open command wheel',
    'mc.group':               'GROUP',
    'mc.split':               'SPLIT',

    // ── Language toggle ───────────────────────────────────────────────────
    'lang.toggle':            'عربي',
    'lang.toggle_title':      'التبديل إلى العربية',
  },
};

// ── Runtime state ─────────────────────────────────────────────────────────────

let _lang = localStorage.getItem('xgame_lang') ?? 'ar';
const _listeners = [];

// Apply immediately on load
_applyDir(_lang);

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Translate a key, interpolating {var} placeholders.
 * Falls back to Arabic, then the raw key.
 */
export function t(key, vars = {}) {
  const str = (STRINGS[_lang] ?? STRINGS.ar)[key]
           ?? STRINGS.ar[key]
           ?? key;
  return str.replace(/\{(\w+)\}/g, (_, k) => String(vars[k] ?? ''));
}

export function getLang() { return _lang; }

export function setLang(lang) {
  if (!STRINGS[lang]) return;
  _lang = lang;
  localStorage.setItem('xgame_lang', _lang);
  _applyDir(_lang);
  // Re-render all marked DOM elements
  document.querySelectorAll('[data-i18n]').forEach(el => {
    el.textContent = t(el.dataset.i18n);
  });
  _listeners.forEach(fn => fn(_lang));
}

/** Register a callback fired whenever the language changes. */
export function onLangChange(fn) { _listeners.push(fn); }

// ── Internal ──────────────────────────────────────────────────────────────────

function _applyDir(lang) {
  document.documentElement.lang = lang;
  document.documentElement.dir  = lang === 'ar' ? 'rtl' : 'ltr';
}
