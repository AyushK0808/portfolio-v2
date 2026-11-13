'use client';

import { useEffect, useRef, useState } from 'react';
import { useApp } from '@/state/store';
import { audio } from '@/systems/audio';
import { LOCATIONS } from '@/lib/theme';
import { scroll } from '@/systems/scroll';
import { camTelemetry } from '../three/CameraDirector';
import { CardData, cardFor } from './cards';

/** portrait with a silhouette fallback until a real photo is supplied */
function Portrait({
  src,
  name,
  focus,
}: {
  src: string;
  name: string;
  focus?: { x: number; y: number; zoom: number };
}) {
  const [failed, setFailed] = useState(false);
  return (
    <div className="holo-portrait" aria-hidden={failed}>
      {failed ? (
        <svg viewBox="0 0 64 80" width="100%" height="100%">
          <circle cx="32" cy="28" r="13" fill="currentColor" opacity="0.55" />
          <path d="M8 80c0-15 10.5-25 24-25s24 10 24 25z" fill="currentColor" opacity="0.4" />
        </svg>
      ) : (
        // a plain <img>: the photo is optional and may not exist yet, so we
        // need onError to fall back to the silhouette
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={src}
          alt={`Portrait of ${name}`}
          onError={() => setFailed(true)}
          style={
            focus
              ? {
                  objectPosition: `${focus.x}% ${focus.y}%`,
                  transformOrigin: `${focus.x}% ${focus.y}%`,
                  transform: `scale(${focus.zoom})`,
                }
              : undefined
          }
        />
      )}
    </div>
  );
}

function CardBody({ data }: { data: CardData }) {
  return (
    <>
      <div className="holo-card-eyebrow font-data">{data.eyebrow}</div>
      <div className="holo-card-head">
        {data.photo && <Portrait src={data.photo} name={data.title} focus={data.photoFocus} />}
        <div className="min-w-0">
          <h2 className="holo-card-title font-hud">{data.title}</h2>
          {data.subtitle && <div className="holo-card-subtitle font-hud">{data.subtitle}</div>}
          {data.meta && <div className="holo-card-meta font-data">{data.meta}</div>}
        </div>
      </div>

      {data.paragraphs?.map((p) => (
        <p key={p.slice(0, 32)} className="holo-card-text">
          {p}
        </p>
      ))}

      {data.bullets && (
        <ul className="holo-card-bullets">
          {data.bullets.map((b) => (
            <li key={b.slice(0, 32)}>{b}</li>
          ))}
        </ul>
      )}

      {data.chips && data.chips.length > 0 && (
        <div className="holo-card-chips">
          {data.chipsLabel && <span className="holo-card-chips-label font-data">{data.chipsLabel}</span>}
          {data.chips.map((c) => (
            <span key={c} className="holo-chip font-data">
              {c}
            </span>
          ))}
        </div>
      )}

      {data.links && data.links.length > 0 && (
        <div className="holo-card-links">
          {data.links.map((l) => (
            <a
              key={l.href}
              href={l.href}
              target="_blank"
              rel="noopener noreferrer"
              className="hud-btn holo-card-link"
              onMouseEnter={() => audio.blip()}
            >
              {l.label} ▸
            </a>
          ))}
        </div>
      )}
    </>
  );
}

/**
 * The content card for the stop the ship is resting at: real HTML styled as a
 * hologram, so text stays sharp at any size and links are tappable. It docks to
 * the right on wide screens and becomes a bottom sheet on upright ones (CSS),
 * fades with the ship's distance from the stop, and a leader line ties it to
 * the stop's object in the 3D world.
 */
export function ContentCard() {
  const location = useApp((s) => s.location);
  const stop = useApp((s) => s.stop);
  const data = cardFor(location, stop);
  const theme = LOCATIONS[location];

  const cardRef = useRef<HTMLElement>(null);
  const lineRef = useRef<SVGLineElement>(null);
  const dotRef = useRef<SVGCircleElement>(null);
  const hasCard = data !== null;

  useEffect(() => {
    let raf = 0;
    const frame = () => {
      raf = requestAnimationFrame(frame);
      const card = cardRef.current;
      const line = lineRef.current;
      const dot = dotRef.current;
      const show = hasCard ? scroll.near : 0;
      const upright = window.innerHeight > window.innerWidth || window.innerWidth < 720;

      if (card) {
        card.style.opacity = String(show);
        const off = (1 - show) * 18;
        card.style.transform = upright ? `translateY(${off}px)` : `translateX(${off}px)`;
        card.style.pointerEvents = show > 0.6 ? 'auto' : 'none';
      }
      if (line && dot) {
        if (card && show > 0.05 && camTelemetry.anchorVisible) {
          const r = card.getBoundingClientRect();
          // from the card's near edge to the object it describes
          const x1 = upright ? r.left + r.width / 2 : r.left;
          const y1 = upright ? r.top : r.top + r.height / 2;
          line.setAttribute('x1', x1.toFixed(1));
          line.setAttribute('y1', y1.toFixed(1));
          line.setAttribute('x2', camTelemetry.anchorX.toFixed(1));
          line.setAttribute('y2', camTelemetry.anchorY.toFixed(1));
          dot.setAttribute('cx', camTelemetry.anchorX.toFixed(1));
          dot.setAttribute('cy', camTelemetry.anchorY.toFixed(1));
          line.style.opacity = String(show * 0.55);
          dot.style.opacity = String(show * 0.9);
        } else {
          line.style.opacity = '0';
          dot.style.opacity = '0';
        }
      }
    };
    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, [hasCard]);

  if (!data) return null;

  return (
    <>
      <svg className="absolute inset-0 h-full w-full pointer-events-none" aria-hidden="true">
        <line ref={lineRef} stroke={theme.base} strokeWidth="1" strokeDasharray="3 4" style={{ opacity: 0 }} />
        <circle ref={dotRef} r="4" fill="none" stroke={theme.bright} strokeWidth="1.5" style={{ opacity: 0 }} />
      </svg>
      <div className="card-dock">
        <article
          ref={cardRef}
          key={`${location}-${stop}`}
          className="holo-card"
          style={{ ['--accent' as string]: theme.base, ['--accent-bright' as string]: theme.bright, opacity: 0 }}
          aria-live="polite"
        >
          <CardBody data={data} />
        </article>
      </div>
    </>
  );
}
