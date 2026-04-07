// ── Boids parameter multipliers per formation ─────────────────────────────────
// Applied on top of each role's base boids config in SwarmController.update()
// sep = separationWeight, ali = alignmentWeight, coh = cohesionWeight, seek = seekWeight
export const FORMATION_BOIDS = {
  // وتش WATCH — balanced patrol stance (default)
  watch:  { sep: 1.0, ali: 1.0, coh: 0.8, seek: 1.0, label: 'وتش  WATCH',  hint: 'دورية متوازنة — مناسب للدفاع العام' },
  // خنجر DAGGER — aggressive rush, tight pack, high seek
  dagger: { sep: 0.4, ali: 1.2, coh: 2.5, seek: 2.8, label: 'خنجر DAGGER', hint: 'هجوم مركّز — يخترق الخطوط السريع' },
  // درع SHIELD — wide defensive arc, high separation
  shield: { sep: 2.8, ali: 0.8, coh: 1.6, seek: 0.5, label: 'درع  SHIELD', hint: 'قوس دفاعي — يحمي المدن من الجانبين' },
  // شبكة NET — maximum spread, encirclement
  net:    { sep: 3.2, ali: 0.5, coh: 0.2, seek: 1.3, label: 'شبكة NET',    hint: 'تطويق واسع — يُحاصر الأعداء في المنتصف' },
  // نقطة POINT — dense scout, breaks stealth cover
  point:  { sep: 0.2, ali: 1.5, coh: 3.5, seek: 3.5, label: 'نقطة POINT',  hint: 'كتلة كثيفة — يكشف المتخفّين بالتركيز' },
};

// ── Position layout functions per formation ────────────────────────────────────
// Each returns an array of {x, y} world positions for N drones around center (cx, cy).

function _watch(n, cx, cy, angle = 0) {
  // Balanced wedge — same as classic wedge
  const positions = [];
  const rows = Math.ceil(Math.sqrt(n));
  let placed = 0;
  for (let row = 0; row < rows && placed < n; row++) {
    const cols = Math.min(row * 2 + 1, n - placed);
    for (let col = 0; col < cols; col++) {
      const ox = (col - (cols - 1) / 2) * 28;
      const oy = row * 28;
      const rx = ox * Math.cos(angle) - oy * Math.sin(angle);
      const ry = ox * Math.sin(angle) + oy * Math.cos(angle);
      positions.push({ x: cx + rx, y: cy + ry });
      placed++;
    }
  }
  return positions;
}

function _dagger(n, cx, cy) {
  // Tight arrow/spearhead — narrow column, drones packed forward
  return Array.from({ length: n }, (_, i) => {
    const row = Math.floor(i / 2);
    const side = i % 2 === 0 ? -1 : 1;
    const colOffset = row === 0 ? 0 : side * (row * 14);
    return { x: cx + colOffset, y: cy + row * 22 };
  });
}

function _shield(n, cx, cy) {
  // Wide crescent arc — drones spread in a forward-facing semicircle
  return Array.from({ length: n }, (_, i) => {
    const a = Math.PI * (0.15 + 0.70 * (i / Math.max(n - 1, 1)));
    const r = 55 + n * 2.5;
    return { x: cx + Math.cos(a) * r, y: cy - Math.sin(a) * r * 0.7 };
  });
}

function _net(n, cx, cy) {
  // Maximum spread grid — fills a wide rectangular area
  const cols = Math.ceil(Math.sqrt(n * 1.8));
  const rows = Math.ceil(n / cols);
  const gapX = 60, gapY = 52;
  return Array.from({ length: n }, (_, i) => {
    const c = i % cols;
    const r = Math.floor(i / cols);
    return {
      x: cx + (c - (cols - 1) / 2) * gapX + (Math.random() - 0.5) * 8,
      y: cy + (r - (rows - 1) / 2) * gapY + (Math.random() - 0.5) * 8,
    };
  });
}

function _point(n, cx, cy) {
  // Dense cluster — all drones converge to a tight spiral around the center
  return Array.from({ length: n }, (_, i) => {
    const a = (i / n) * Math.PI * 6;
    const r = 4 + i * 2.8;
    return { x: cx + Math.cos(a) * r, y: cy + Math.sin(a) * r };
  });
}

// ── Formation registry ─────────────────────────────────────────────────────────
export const FORMATIONS = {
  watch:  _watch,
  dagger: _dagger,
  shield: _shield,
  net:    _net,
  point:  _point,

  // Legacy aliases (old code may reference these)
  wedge(n, cx, cy, angle = 0) { return _watch(n, cx, cy, angle); },

  circle(n, cx, cy) {
    return Array.from({ length: n }, (_, i) => {
      const a = (2 * Math.PI * i) / n;
      const r = 20 + n * 3.5;
      return { x: cx + Math.cos(a) * r, y: cy + Math.sin(a) * r };
    });
  },

  scatter(n, cx, cy) {
    return Array.from({ length: n }, () => ({
      x: cx + (Math.random() - 0.5) * 200,
      y: cy + (Math.random() - 0.5) * 200,
    }));
  },

  line(n, cx, cy, angle = 0) {
    return Array.from({ length: n }, (_, i) => {
      const t = (i - (n - 1) / 2) * 28;
      return {
        x: cx + t * Math.cos(angle + Math.PI / 2),
        y: cy + t * Math.sin(angle + Math.PI / 2),
      };
    });
  },

  defend(n, cx, cy) {
    return Array.from({ length: n }, (_, i) => {
      const a = (2 * Math.PI * i) / n;
      const r = 50 + n * 2;
      return { x: cx + Math.cos(a) * r, y: cy + Math.sin(a) * r };
    });
  },
};

export const FORMATION_NAMES = Object.keys(FORMATIONS);
