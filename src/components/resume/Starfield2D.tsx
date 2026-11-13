'use client';

import { useEffect, useRef } from 'react';
import { sky } from './sky';

/**
 * The résumé page's sky: a deep starfield drawn on a plain 2D canvas (no
 * WebGL, so it works in the browsers that get sent to this page).
 *
 *  - the stars stay put: they do not move or stretch when the page scrolls,
 *    they only twinkle
 *  - soft nebula colour follows `sky.tint`, the colour of the section in view
 *  - every few seconds a shooting star crosses
 *
 * With reduced motion it is a still sky (no twinkle, no shooting stars) that
 * only repaints when the tint changes with the section.
 */

interface Star {
  x: number;
  y: number;
  /** depth: 0.15 (far, small, dim) … 1 (near, large, bright) */
  z: number;
  r: number;
  phase: number;
  speed: number;
  color: string;
}

const STAR_COLORS = ['234,246,250', '234,246,250', '234,246,250', '160,228,255', '215,190,255', '255,226,180'];

function seeded(seed: number) {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export default function Starfield2D() {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    const rng = seeded(4107);
    const count = window.innerWidth < 720 ? 150 : 300;
    const stars: Star[] = Array.from({ length: count }, () => {
      const z = 0.15 + Math.pow(rng(), 1.7) * 0.85;
      return {
        x: rng(),
        y: rng(),
        z,
        r: 0.5 + z * 1.1,
        phase: rng() * Math.PI * 2,
        speed: 0.6 + rng() * 1.6,
        color: STAR_COLORS[Math.floor(rng() * STAR_COLORS.length)],
      };
    });

    let W = 0;
    let H = 0;
    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
      W = window.innerWidth;
      H = window.innerHeight;
      canvas.width = Math.round(W * dpr);
      canvas.height = Math.round(H * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();

    const tint = [...sky.tint];
    const t0 = performance.now();
    let last = t0;
    let raf = 0;
    // one shooting star at a time; speeds are pixels per second
    let shoot: { x: number; y: number; vx: number; vy: number; life: number } | null = null;
    let nextShoot = 1.5 + Math.random() * 2.5;

    const blob = (x: number, y: number, r: number, rgb: string, a: number) => {
      const g = ctx.createRadialGradient(x, y, 0, x, y, r);
      g.addColorStop(0, `rgba(${rgb},${a})`);
      g.addColorStop(1, `rgba(${rgb},0)`);
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, W, H);
    };

    const draw = (now: number, still: boolean) => {
      const t = (now - t0) / 1000;
      const dt = Math.min(0.05, Math.max(0, (now - last) / 1000));
      last = now;
      for (let k = 0; k < 3; k++) tint[k] += (sky.tint[k] - tint[k]) * (still ? 1 : 0.035);

      ctx.clearRect(0, 0, W, H);

      // nebula: the section's colour, a violet counterweight, a cool base
      const big = Math.max(W, H);
      const rgb = `${tint[0] | 0},${tint[1] | 0},${tint[2] | 0}`;
      blob(W * 0.8, H * 0.22, big * 0.62, rgb, 0.13);
      blob(W * 0.12, H * 0.82, big * 0.55, '109,40,217', 0.1);
      blob(W * 0.45, H * 0.55, big * 0.5, rgb, 0.045);

      // stars: fixed in place, twinkling
      for (const s of stars) {
        const twinkle = still ? 1 : 0.72 + 0.28 * Math.sin(t * s.speed + s.phase);
        ctx.fillStyle = `rgba(${s.color},${(0.3 + 0.7 * s.z) * twinkle})`;
        ctx.beginPath();
        ctx.arc(s.x * W, s.y * H, s.r, 0, Math.PI * 2);
        ctx.fill();
      }

      // shooting star: a bright head on a long fading tail
      if (still) return;
      if (!shoot && t > nextShoot) {
        const fromLeft = Math.random() < 0.5;
        const speed = 620 + Math.random() * 420;
        const angle = 0.3 + Math.random() * 0.35; // downward slope, radians
        shoot = {
          x: fromLeft ? W * (0.02 + Math.random() * 0.45) : W * (0.53 + Math.random() * 0.45),
          y: H * (0.02 + Math.random() * 0.45),
          vx: (fromLeft ? 1 : -1) * Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed,
          life: 1,
        };
      }
      if (shoot) {
        shoot.x += shoot.vx * dt;
        shoot.y += shoot.vy * dt;
        shoot.life -= dt * 1.15;
        // fades in fast, out slowly
        const a = Math.max(0, Math.min(1, (1 - shoot.life) * 8, shoot.life * 1.6));
        const tx = shoot.x - shoot.vx * 0.22;
        const ty = shoot.y - shoot.vy * 0.22;
        const g = ctx.createLinearGradient(shoot.x, shoot.y, tx, ty);
        g.addColorStop(0, `rgba(240,250,255,${0.95 * a})`);
        g.addColorStop(0.25, `rgba(160,228,255,${0.4 * a})`);
        g.addColorStop(1, 'rgba(160,228,255,0)');
        ctx.strokeStyle = g;
        ctx.lineWidth = 1.8;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(shoot.x, shoot.y);
        ctx.lineTo(tx, ty);
        ctx.stroke();
        const head = ctx.createRadialGradient(shoot.x, shoot.y, 0, shoot.x, shoot.y, 7);
        head.addColorStop(0, `rgba(255,255,255,${0.9 * a})`);
        head.addColorStop(1, 'rgba(160,228,255,0)');
        ctx.fillStyle = head;
        ctx.beginPath();
        ctx.arc(shoot.x, shoot.y, 7, 0, Math.PI * 2);
        ctx.fill();
        if (shoot.life <= 0) {
          shoot = null;
          nextShoot = t + 3 + Math.random() * 5;
        }
      }
    };

    if (reduce) {
      // a still sky: repaint only when something changes
      let queued = false;
      const repaint = () => {
        if (queued) return;
        queued = true;
        requestAnimationFrame((now) => {
          queued = false;
          draw(now, true);
        });
      };
      const onResize = () => {
        resize();
        repaint();
      };
      repaint();
      window.addEventListener('scroll', repaint, { passive: true });
      window.addEventListener('resize', onResize);
      return () => {
        window.removeEventListener('scroll', repaint);
        window.removeEventListener('resize', onResize);
      };
    }

    const frame = (now: number) => {
      raf = requestAnimationFrame(frame);
      draw(now, false);
    };
    const onVisibility = () => {
      cancelAnimationFrame(raf);
      if (!document.hidden) {
        last = performance.now();
        raf = requestAnimationFrame(frame);
      }
    };
    raf = requestAnimationFrame(frame);
    window.addEventListener('resize', resize);
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', resize);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, []);

  return <canvas ref={ref} className="rz-sky" aria-hidden="true" />;
}
