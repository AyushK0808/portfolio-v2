/**
 * What the résumé page's sky is doing, shared between the scroll animations
 * (which write it) and the starfield canvas (which reads it every frame).
 * Plain mutable state: it changes many times a second and nothing renders
 * from it, so it does not belong in React.
 */
export const sky = {
  /** the nebula's colour target, 0..255 per channel; the canvas eases toward it */
  tint: [0, 217, 245] as [number, number, number],
};

export function setSkyTint(hex: string): void {
  const h = hex.replace('#', '');
  sky.tint = [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
}
