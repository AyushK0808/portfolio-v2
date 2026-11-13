'use client';

import { RefObject, useEffect, useRef, useState } from 'react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { Pt, meander, smoothPath } from '@/lib/curves';

interface Shape {
  w: number;
  h: number;
  d: string;
}

/**
 * The flight route, drawn flat down the whole page — the résumé's version of
 * the galaxy chart. It passes through every element marked
 * `data-route-anchor` (the hero's launch point, each section's world, the
 * footer), winding between them. As the page scrolls, the bright line draws
 * itself as far as the middle of the screen and a small ship rides its tip.
 *
 * An anchor inside a pinned section is measured against that section's
 * `data-route-host`, so the route stays put while the section is held.
 */
export default function Route({ root }: { root: RefObject<HTMLDivElement | null> }) {
  const [shape, setShape] = useState<Shape | null>(null);
  const plan = useRef<SVGPathElement>(null);
  const line = useRef<SVGPathElement>(null);
  const glow = useRef<SVGPathElement>(null);
  const ship = useRef<SVGGElement>(null);

  // where the route runs: re-measured whenever the layout settles
  useEffect(() => {
    const el = root.current;
    if (!el) return;
    const measure = () => {
      const rr = el.getBoundingClientRect();
      const pts: Pt[] = [];
      el.querySelectorAll<HTMLElement>('[data-route-anchor]').forEach((a) => {
        const host = a.closest<HTMLElement>('[data-route-host]') ?? a;
        const spacer = host.parentElement;
        const flow = spacer?.classList.contains('pin-spacer') ? spacer : host;
        const ar = a.getBoundingClientRect();
        const hr = host.getBoundingClientRect();
        const fr = flow.getBoundingClientRect();
        pts.push([
          fr.left - rr.left + (ar.left - hr.left) + ar.width / 2,
          fr.top - rr.top + (ar.top - hr.top) + ar.height / 2,
        ]);
      });
      if (pts.length < 2) return;
      const w = el.offsetWidth;
      const h = el.scrollHeight;
      const d = smoothPath(meander(pts, Math.min(120, w * 0.1)));
      setShape((prev) => (prev && prev.d === d && prev.w === w && prev.h === h ? prev : { w, h, d }));
    };
    measure();
    ScrollTrigger.addEventListener('refresh', measure);
    return () => ScrollTrigger.removeEventListener('refresh', measure);
  }, [root]);

  // drawing it as the page scrolls
  useEffect(() => {
    const el = root.current;
    const path = plan.current;
    const drawn = line.current;
    const halo = glow.current;
    const marker = ship.current;
    if (!shape || !el || !path || !drawn || !halo || !marker) return;

    const len = path.getTotalLength();
    drawn.style.strokeDasharray = halo.style.strokeDasharray = `${len}`;

    // page height → distance along the route (the route only ever heads down
    // the page, give or take a wobble, so a running maximum makes it searchable)
    const N = 600;
    const ys = new Float32Array(N + 1);
    for (let i = 0; i <= N; i++) {
      const y = path.getPointAtLength((len * i) / N).y;
      ys[i] = i > 0 && y < ys[i - 1] ? ys[i - 1] : y;
    }
    const lengthAt = (y: number) => {
      if (y <= ys[0]) return 0;
      if (y >= ys[N]) return len;
      let lo = 0;
      let hi = N;
      while (hi - lo > 1) {
        const mid = (lo + hi) >> 1;
        if (ys[mid] < y) lo = mid;
        else hi = mid;
      }
      const span = ys[hi] - ys[lo] || 1;
      return (len * (lo + (y - ys[lo]) / span)) / N;
    };

    const state = { l: 0 };
    const apply = () => {
      const off = `${len - state.l}`;
      drawn.style.strokeDashoffset = off;
      halo.style.strokeDashoffset = off;
      const l = Math.min(state.l, len - 3);
      const p = path.getPointAtLength(l);
      const q = path.getPointAtLength(l + 3);
      const angle = (Math.atan2(q.y - p.y, q.x - p.x) * 180) / Math.PI;
      marker.setAttribute(
        'transform',
        `translate(${p.x.toFixed(1)} ${p.y.toFixed(1)}) rotate(${angle.toFixed(1)})`,
      );
    };

    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const update = () => {
      // the ship holds a little below the middle of the screen
      const target = -el.getBoundingClientRect().top + window.innerHeight * 0.56;
      const l = lengthAt(target);
      if (reduce) {
        state.l = l;
        apply();
      } else {
        gsap.to(state, { l, duration: 0.55, ease: 'power2.out', overwrite: true, onUpdate: apply });
      }
    };
    const st = ScrollTrigger.create({ start: 0, end: 'max', onUpdate: update, onRefresh: update });
    apply();
    update();
    return () => {
      st.kill();
      gsap.killTweensOf(state);
    };
  }, [shape, root]);

  if (!shape) return null;
  return (
    <svg
      className="rz-route"
      width={shape.w}
      height={shape.h}
      viewBox={`0 0 ${shape.w} ${shape.h}`}
      aria-hidden="true"
    >
      {/* the planned route ahead, then the part already flown */}
      <path ref={plan} d={shape.d} className="rz-route-plan" />
      <path ref={glow} d={shape.d} className="rz-route-glow" />
      <path ref={line} d={shape.d} className="rz-route-line" />
      <g ref={ship} className="rz-route-ship">
        <circle r="13" className="rz-route-ship-halo" />
        <path d="M -5 0 L -22 0" className="rz-route-ship-trail" />
        <path d="M 12 0 L -7 -6.5 L -3 0 L -7 6.5 Z" className="rz-route-ship-hull" />
      </g>
    </svg>
  );
}
