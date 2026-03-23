// Returns an array of {x, y} offset positions for N drones around a center point
export const FORMATIONS = {
  wedge(n, cx, cy, angle = 0) {
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
  },

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
    // tight circle around the point — defensive ring
    return Array.from({ length: n }, (_, i) => {
      const a = (2 * Math.PI * i) / n;
      const r = 50 + n * 2;
      return { x: cx + Math.cos(a) * r, y: cy + Math.sin(a) * r };
    });
  },
};

export const FORMATION_NAMES = Object.keys(FORMATIONS);
