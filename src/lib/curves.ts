// Route-drawing helpers shared by the galaxy chart (3D site) and the résumé
// page's route line. No dependencies, so either bundle can use them.

export type Pt = [number, number];

/** deterministic 0..1 from an index, so layouts are identical every visit */
export const rand = (i: number) => {
  const x = Math.sin(i * 127.1 + 311.7) * 43758.5453;
  return x - Math.floor(x);
};

/** smooth path through points (Catmull-Rom converted to cubic Béziers) */
export function smoothPath(pts: Pt[]): string {
  if (pts.length < 2) return '';
  let d = `M ${pts[0][0].toFixed(1)} ${pts[0][1].toFixed(1)}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[Math.max(i - 1, 0)];
    const p1 = pts[i];
    const p2 = pts[i + 1];
    const p3 = pts[Math.min(i + 2, pts.length - 1)];
    const c1: Pt = [p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6];
    const c2: Pt = [p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6];
    d += ` C ${c1[0].toFixed(1)} ${c1[1].toFixed(1)}, ${c2[0].toFixed(1)} ${c2[1].toFixed(1)}, ${p2[0].toFixed(1)} ${p2[1].toFixed(1)}`;
  }
  return d;
}

/** where that same curve is, and which way it heads, `t` of the way from pts[i] to pts[i+1] */
export function pathAt(pts: Pt[], i: number, t: number): { at: Pt; angle: number } {
  const p0 = pts[Math.max(i - 1, 0)];
  const p1 = pts[i];
  const p2 = pts[i + 1];
  const p3 = pts[Math.min(i + 2, pts.length - 1)];
  const axis = (k: 0 | 1) => {
    const a = -p0[k] + p2[k];
    const b = 2 * p0[k] - 5 * p1[k] + 4 * p2[k] - p3[k];
    const c = -p0[k] + 3 * p1[k] - 3 * p2[k] + p3[k];
    return {
      v: 0.5 * (2 * p1[k] + a * t + b * t * t + c * t * t * t),
      d: 0.5 * (a + 2 * b * t + 3 * c * t * t),
    };
  };
  const x = axis(0);
  const y = axis(1);
  return { at: [x.v, y.v], angle: (Math.atan2(y.d, x.d) * 180) / Math.PI };
}

/**
 * A route is never a straight line: every leg between two stops gets two extra
 * points pushed off to alternate sides, so it wanders in loose S-curves like a
 * hand-drawn chart. Stop k of the input is point 3k of the output.
 */
export function meander(nodes: Pt[], amp: number): Pt[] {
  if (nodes.length === 0) return [];
  const out: Pt[] = [nodes[0]];
  for (let i = 0; i < nodes.length - 1; i++) {
    const a = nodes[i];
    const b = nodes[i + 1];
    const dx = b[0] - a[0];
    const dy = b[1] - a[1];
    const len = Math.hypot(dx, dy) || 1;
    const nx = -dy / len;
    const ny = dx / len;
    const k = amp * (0.75 + rand(i + 50) * 0.5) * (i % 2 === 0 ? 1 : -1);
    out.push([a[0] + dx * 0.3 + nx * k, a[1] + dy * 0.3 + ny * k]);
    out.push([a[0] + dx * 0.7 - nx * k * 0.8, a[1] + dy * 0.7 - ny * k * 0.8]);
    out.push(b);
  }
  return out;
}
