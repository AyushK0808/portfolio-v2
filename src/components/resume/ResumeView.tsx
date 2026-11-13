'use client';

import Link from 'next/link';
import dynamic from 'next/dynamic';
import { CSSProperties, FormEvent, MouseEvent, ReactNode, useEffect, useRef, useState } from 'react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { FaBars, FaXmark, FaGithub, FaLinkedinIn, FaEnvelope, FaRocket } from 'react-icons/fa6';
import { SITE, FREQUENCIES } from '@/content/site';
import { DOSSIER, HOW_I_WORK, INTERESTS } from '@/content/bio';
import { EXPERIENCE } from '@/content/experience';
import { EDUCATION } from '@/content/education';
import { GITHUB_URL, PROJECTS } from '@/content/projects';
import { SKILLS } from '@/content/skills';
import { ACHIEVEMENTS } from '@/content/achievements';
import { LOCATIONS, LocationId } from '@/lib/theme';
import { TECH } from './techMap';
import { setSkyTint } from './sky';
import Starfield2D from './Starfield2D';
import Route from './Route';

// WebGL line-waves shimmer for the hero — an extra, only where WebGL exists
const LineWaves = dynamic(() => import('./LineWaves'), { ssr: false });

/* ─────────────────────────── the route ─────────────────────────── */

/**
 * The page is the 3D site's flight, drawn flat: the same stops in the same
 * order, each wearing its world's name, colours and picture.
 */
interface StopDef {
  id: string;
  label: string;
  location: LocationId;
  /** one plain line under the heading */
  brief: string;
}

const STOPS: StopDef[] = [
  { id: 'about', label: 'About', location: 'ABOUT', brief: 'Home world. Who is flying this thing.' },
  { id: 'skills', label: 'Skills', location: 'SKILLS', brief: 'Five docks, five disciplines.' },
  { id: 'experience', label: 'Experience', location: 'EXPERIENCE', brief: 'Four postings along the approach lane, newest first.' },
  { id: 'projects', label: 'Projects', location: 'PROJECTS', brief: 'Five solo builds adrift in the belt.' },
  { id: 'achievements', label: 'Achievements', location: 'ACHIEVEMENTS', brief: 'Beacons for the wins worth marking.' },
  { id: 'contact', label: 'Contact', location: 'COMMS', brief: 'Channel open. Pick a frequency or send a message.' },
];

const SOCIALS = [
  { id: 'github', Icon: FaGithub, href: 'https://github.com/AyushK0808', label: 'GitHub' },
  { id: 'linkedin', Icon: FaLinkedinIn, href: 'https://www.linkedin.com/in/ayushk0808', label: 'LinkedIn' },
  { id: 'email', Icon: FaEnvelope, href: `mailto:${SITE.email}`, label: 'Email' },
];

/** numbers from the résumé, counted up when they scroll into view */
const STATS = [
  { to: 9.35, decimals: 2, suffix: '', label: 'GPA out of 10, VIT Vellore' },
  { to: 22, decimals: 0, suffix: '+', label: 'production regions shipped to' },
  { to: 30, decimals: 0, suffix: 'K+', label: 'campus users served' },
  { to: 200, decimals: 0, suffix: '+', label: 'members mentored' },
];

/* ─────────────────────────── helpers ─────────────────────────── */

const accentVars = (location: LocationId) => {
  const t = LOCATIONS[location];
  return { '--accent': t.base, '--accent-bright': t.bright, '--accent-deep': t.deep } as CSSProperties;
};

/** scroll to a section, allowing for the fixed bar and for a pinned section's spacer */
function flyTo(id: string, smooth = true) {
  const el = document.getElementById(id);
  if (!el) return;
  const spacer = el.parentElement;
  const flow = spacer?.classList.contains('pin-spacer') ? spacer : el;
  const top = id === 'home' ? 0 : flow.getBoundingClientRect().top + window.scrollY - 56;
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  window.scrollTo({ top, behavior: smooth && !reduce ? 'smooth' : 'auto' });
}

const onNav = (id: string, after?: () => void) => (e: MouseEvent) => {
  e.preventDefault();
  after?.();
  flyTo(id);
  history.replaceState(null, '', id === 'home' ? window.location.pathname : `#${id}`);
};

/** a word as separate letters, so each can be animated; read aloud as one word */
function Chars({ text }: { text: string }) {
  return (
    <>
      {[...text].map((c, i) => (
        <span key={i} className="rz-char" aria-hidden="true">
          {c === ' ' ? ' ' : c}
        </span>
      ))}
    </>
  );
}

/** terminal decode: the text resolves left to right out of noise */
function scramble(el: HTMLElement, duration = 0.9) {
  const final = el.dataset.text ?? el.textContent ?? '';
  el.dataset.text = final;
  const GLYPHS = '▚▞░▒#$%<>[]/01';
  const o = { p: 0 };
  gsap.to(o, {
    p: 1,
    duration,
    ease: 'none',
    overwrite: true,
    onUpdate: () => {
      const n = Math.floor(o.p * final.length);
      let s = final.slice(0, n);
      for (let i = n; i < Math.min(final.length, n + 4); i++) {
        s += final[i] === ' ' ? ' ' : GLYPHS[Math.floor(Math.random() * GLYPHS.length)];
      }
      el.textContent = s;
    },
    onComplete: () => {
      el.textContent = final;
    },
  });
}

function TechChip({ name }: { name: string }) {
  const meta = TECH[name];
  return (
    <span
      className="tech-chip font-data"
      style={meta ? ({ '--chip-color': meta.color } as CSSProperties) : undefined}
    >
      {meta && <meta.Icon size={14} aria-hidden />}
      {name}
    </span>
  );
}

/* ─────────────────────────── navbar ──────────────────────────── */

function Navbar({ active }: { active: string }) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <nav className="resume-nav fixed left-0 top-0 z-50 w-full" aria-label="Sections">
        <div className="rz-progress" aria-hidden="true" />
        <div className="mx-auto flex max-w-6xl items-center justify-between px-5 py-3.5 md:px-8">
          <a
            href="#home"
            onClick={onNav('home')}
            className="font-hero"
            style={{ fontSize: '0.95rem', color: 'var(--text-primary)', letterSpacing: '0.2em' }}
          >
            AYUSH<span style={{ color: 'var(--hud-cyan)' }}> KUMAR</span>
          </a>

          {/* desktop links */}
          <div className="hidden items-center gap-6 lg:flex">
            {STOPS.map((s) => (
              <a
                key={s.id}
                href={`#${s.id}`}
                onClick={onNav(s.id)}
                className="resume-nav-link font-hud"
                data-active={active === s.id}
                aria-current={active === s.id ? 'true' : undefined}
                style={{ fontSize: '0.6875rem' }}
              >
                {s.label}
              </a>
            ))}
            <span style={{ color: 'var(--panel-edge)' }}>|</span>
            {SOCIALS.map(({ id, Icon, href, label }) => (
              <a
                key={id}
                href={href}
                target="_blank"
                rel="noopener noreferrer"
                aria-label={label}
                className="resume-nav-link"
              >
                <Icon size={16} />
              </a>
            ))}
            <Link href="/" className="hud-btn" style={{ fontSize: '0.625rem' }}>
              <FaRocket size={10} style={{ display: 'inline', marginRight: 6 }} />
              3D VERSION
            </Link>
          </div>

          {/* mobile hamburger */}
          <button
            className="lg:hidden"
            aria-label={open ? 'Close menu' : 'Open menu'}
            aria-expanded={open}
            onClick={() => setOpen((v) => !v)}
            style={{ color: 'var(--hud-cyan)', background: 'none', border: 'none', cursor: 'pointer' }}
          >
            {open ? <FaXmark size={22} /> : <FaBars size={20} />}
          </button>
        </div>
      </nav>

      {/* mobile drawer */}
      <div
        className="fixed inset-0 z-40 lg:hidden"
        style={{
          background: 'rgba(5,6,10,0.6)',
          opacity: open ? 1 : 0,
          pointerEvents: open ? 'auto' : 'none',
          transition: 'opacity 260ms ease',
        }}
        onClick={() => setOpen(false)}
      />
      <div
        className="fixed right-0 top-0 z-50 flex h-full w-64 flex-col gap-2 p-6 pt-20 lg:hidden"
        style={{
          background: 'linear-gradient(to bottom, var(--space-deep), var(--void))',
          borderLeft: '1px solid var(--panel-edge)',
          transform: open ? 'translateX(0)' : 'translateX(100%)',
          visibility: open ? 'visible' : 'hidden',
          transition: 'transform 320ms var(--ease-hud-in), visibility 320ms',
        }}
      >
        <button
          aria-label="Close menu"
          onClick={() => setOpen(false)}
          className="absolute right-5 top-5"
          style={{ color: 'var(--hud-cyan)', background: 'none', border: 'none', cursor: 'pointer' }}
        >
          <FaXmark size={22} />
        </button>
        {STOPS.map((s, i) => (
          <a
            key={s.id}
            href={`#${s.id}`}
            onClick={onNav(s.id, () => setOpen(false))}
            className="resume-nav-link font-hud py-2"
            data-active={active === s.id}
            style={{
              fontSize: '0.8125rem',
              transform: open ? 'translateX(0)' : 'translateX(24px)',
              opacity: open ? 1 : 0,
              transition: `all 300ms var(--ease-hud-in) ${80 + i * 45}ms`,
            }}
          >
            {s.label}
          </a>
        ))}
        <div className="mt-4 flex gap-5">
          {SOCIALS.map(({ id, Icon, href, label }) => (
            <a key={id} href={href} target="_blank" rel="noopener noreferrer" aria-label={label}>
              <Icon size={18} />
            </a>
          ))}
        </div>
        <Link href="/" className="hud-btn mt-6 text-center" style={{ fontSize: '0.6875rem' }}>
          BOARD THE SHIP (3D) ▸
        </Link>
      </div>
    </>
  );
}

/** the route as a column of dots down the right edge (wide screens) */
function Rail({ active }: { active: string }) {
  return (
    <div className="rz-rail" aria-hidden="true">
      {STOPS.map((s) => (
        <a
          key={s.id}
          href={`#${s.id}`}
          tabIndex={-1}
          onClick={onNav(s.id)}
          className="rz-rail-stop font-data"
          data-active={active === s.id}
          style={accentVars(s.location)}
        >
          <span className="rz-rail-label">{LOCATIONS[s.location].name}</span>
          <span className="rz-rail-dot" />
        </a>
      ))}
    </div>
  );
}

/* ─────────────────────────── hero ────────────────────────────── */

function Hero({ waves }: { waves: boolean }) {
  return (
    <section id="home" className="rz-hero" data-route-host data-accent="#00D9F5">
      {waves && (
        <div className="rz-hero-waves" aria-hidden="true">
          <LineWaves
            color1="#00D9F5"
            color2="#B266FF"
            color3="#2FE0C8"
            speed={0.25}
            brightness={0.15}
            warpIntensity={0.9}
          />
        </div>
      )}

      {/* the ship, drifting; it leaves as you start to scroll */}
      <div className="rz-hero-ship-wrap" aria-hidden="true">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img className="rz-hero-ship rz-hide" src="/worlds/hub.webp" alt="" />
      </div>

      <div className="rz-hero-inner rz-container">
        <div className="rz-hero-copy">
          <p className="rz-hero-eyebrow rz-hide font-data">{'> pilot record — flat transmission'}</p>
          <h1 className="rz-name rz-hide font-hero" aria-label="Ayush Kumar">
            <span className="rz-name-line">
              <Chars text="AYUSH" />
            </span>
            <span className="rz-name-line rz-name-line--accent">
              <Chars text="KUMAR" />
            </span>
          </h1>
          <p className="rz-hero-line rz-hide font-hud rz-role">
            {DOSSIER.rank} · {DOSSIER.posting}
          </p>
          <p className="rz-hero-line rz-hide rz-lede">{DOSSIER.bio[0]}</p>
          <div className="rz-hero-line rz-hide rz-cta">
            <a href="#contact" onClick={onNav('contact')} className="hud-btn rz-btn rz-btn--solid">
              GET IN TOUCH ▸
            </a>
            <a href={SITE.resumePdf} download className="hud-btn rz-btn">
              RÉSUMÉ PDF ↓
            </a>
            <Link href="/" className="hud-btn rz-btn">
              <FaRocket size={11} style={{ display: 'inline', marginRight: 8 }} />
              BOARD THE SHIP
            </Link>
          </div>
        </div>

        <div className="rz-portrait resume-portrait rz-hide hidden md:block">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={DOSSIER.photo}
            alt="Portrait of Ayush Kumar"
            style={{
              objectPosition: `${DOSSIER.photoFocus.x}% ${DOSSIER.photoFocus.y}%`,
              transformOrigin: `${DOSSIER.photoFocus.x}% ${DOSSIER.photoFocus.y}%`,
              transform: `scale(${DOSSIER.photoFocus.zoom * 0.8})`,
            }}
          />
          <span className="rz-portrait-scan" aria-hidden="true" />
          <div className="resume-portrait-tag font-data">ID · {DOSSIER.status}</div>
        </div>
      </div>

      <a href="#about" onClick={onNav('about')} className="rz-cue rz-hero-line rz-hide font-data">
        <span data-route-anchor className="rz-cue-dot" aria-hidden="true" />
        SCROLL TO FLY THE ROUTE
        <span className="rz-cue-arrow" aria-hidden="true">
          ↓
        </span>
      </a>
    </section>
  );
}

/* ─────────────────────────── a stop ──────────────────────────── */

function Stop({
  index,
  side,
  className = '',
  children,
}: {
  index: number;
  /** which side of the page the world sits on; the heading takes the other */
  side: 'left' | 'right';
  className?: string;
  children: ReactNode;
}) {
  const stop = STOPS[index];
  const theme = LOCATIONS[stop.location];
  const title = stop.label.toUpperCase();
  return (
    <section
      id={stop.id}
      className={`rz-section rz-section--${side} ${className}`}
      style={accentVars(stop.location)}
      data-route-host
      data-accent={theme.base}
    >
      <div className="rz-planet" data-route-anchor aria-hidden="true">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={`/worlds/${stop.location.toLowerCase()}.webp`} alt="" decoding="async" />
      </div>
      <div className="rz-container">
        <header className="rz-head">
          <div className="rz-eyebrow font-data">
            STOP {String(index + 1).padStart(2, '0')} / {String(STOPS.length).padStart(2, '0')} · {theme.name}
          </div>
          <h2 className="rz-title font-hero" aria-label={stop.label}>
            <Chars text={title} />
          </h2>
          <div className="rz-rule" aria-hidden="true" />
          <p className="rz-brief font-data">{stop.brief}</p>
        </header>
      </div>
      {children}
    </section>
  );
}

/** the gap between two stops: a short burst of hyperspace */
function Jump({ to }: { to: number }) {
  const theme = LOCATIONS[STOPS[to].location];
  return (
    <div className="rz-jump" style={accentVars(STOPS[to].location)} aria-hidden="true">
      <span className="rz-jump-line" />
      <span className="rz-jump-label font-data">JUMP · {theme.name}</span>
      <span className="rz-jump-line rz-jump-line--out" />
    </div>
  );
}

/* ─────────────────────────── about ───────────────────────────── */

function About() {
  return (
    <Stop index={0} side="right">
      <div className="rz-container">
        <div className="grid gap-8 md:grid-cols-[1.5fr_1fr]">
          <div>
            {DOSSIER.bio.map((p) => (
              <p key={p.slice(0, 24)} className="rz-prose" data-rz-reveal>
                {p}
              </p>
            ))}
          </div>
          <div className="resume-card p-5" data-rz-reveal>
            <div className="rz-card-kicker font-data">ORIGIN</div>
            <ul className="rz-edu">
              {EDUCATION.map((e) => (
                <li key={e.id}>
                  <div className="font-hud rz-edu-degree">{e.degree}</div>
                  <div className="rz-edu-school">{e.institute}</div>
                  <div className="font-data rz-edu-meta">
                    {e.dates} · {e.grade}
                  </div>
                </li>
              ))}
            </ul>
            <div className="rz-card-kicker font-data mt-5">SPECIALTIES</div>
            <div className="flex flex-wrap gap-2">
              {DOSSIER.traits.map((t) => (
                <span key={t} className="tech-chip font-data">
                  {t}
                </span>
              ))}
            </div>
          </div>
        </div>

        <dl className="rz-stats">
          {STATS.map((s) => (
            <div key={s.label} className="rz-stat" data-rz-reveal>
              <dd className="rz-stat-num font-hero">
                <span data-rz-count={s.to} data-decimals={s.decimals}>
                  {s.to.toFixed(s.decimals)}
                </span>
                {s.suffix}
              </dd>
              <dt className="rz-stat-label font-data">{s.label}</dt>
            </div>
          ))}
        </dl>

        <div className="mt-6 grid gap-4 md:grid-cols-2">
          {[HOW_I_WORK, INTERESTS].map((card) => (
            <div key={card.title} className="resume-card flex flex-col p-5" data-rz-reveal>
              <div className="rz-card-kicker font-data">{card.subtitle}</div>
              <h3 className="font-hud rz-card-title">{card.title}</h3>
              <ul className="rz-bullets flex-1">
                {card.bullets.map((b) => (
                  <li key={b.slice(0, 24)}>{b}</li>
                ))}
              </ul>
              <div className="mt-4 flex flex-wrap gap-2">
                {card.chips.map((c) => (
                  <span key={c} className="tech-chip font-data">
                    {c}
                  </span>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </Stop>
  );
}

/* ─────────────────────────── skills ──────────────────────────── */

function Skills() {
  return (
    <Stop index={1} side="left">
      <div className="rz-container">
        <div className="grid gap-4 md:grid-cols-2">
          {SKILLS.map((g, i) => (
            <div
              key={g.id}
              className={`resume-card h-full p-5 ${i === 0 ? 'md:col-span-2' : ''}`}
              data-rz-reveal
            >
              <div className="rz-card-kicker font-data">
                DOCK {String(i + 1).padStart(2, '0')} · {g.system}
              </div>
              <h3 className="font-hud rz-card-title">{g.domain}</h3>
              <div className="mb-3 flex flex-wrap gap-2">
                {g.items.map((item) => (
                  <TechChip key={item} name={item} />
                ))}
              </div>
              <p className="rz-card-text">{g.proof}</p>
            </div>
          ))}
        </div>
      </div>
    </Stop>
  );
}

/* ─────────────────────────── experience ──────────────────────── */

function Experience() {
  const items = EXPERIENCE.filter((e) => e.kind === 'work').slice().reverse();
  return (
    <Stop index={2} side="right">
      <div className="rz-container">
        <div className="rz-timeline">
          <div className="rz-timeline-track" aria-hidden="true" />
          <div className="rz-timeline-fill" aria-hidden="true" />
          <ol>
            {items.map((e, i) => (
              <li key={e.id} className="rz-posting">
                <span className="rz-posting-node" aria-hidden="true" />
                <div className="resume-card p-5">
                  <div className="rz-card-kicker font-data">
                    POSTING {String(items.length - i).padStart(2, '0')} · {e.dates}
                  </div>
                  <h3 className="font-hud rz-card-title">
                    {e.role}
                    <span className="rz-posting-org"> · {e.org}</span>
                  </h3>
                  <p className="font-data rz-posting-meta">
                    {e.location}
                    {e.link && (
                      <>
                        {' · '}
                        <a href={e.link.href} target="_blank" rel="noopener noreferrer">
                          {e.link.label} ↗
                        </a>
                      </>
                    )}
                  </p>
                  <ul className="rz-bullets">
                    {e.bullets.map((b) => (
                      <li key={b.slice(0, 24)}>{b}</li>
                    ))}
                  </ul>
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {e.tech.map((t) => (
                      <TechChip key={t} name={t} />
                    ))}
                  </div>
                </div>
              </li>
            ))}
          </ol>
        </div>
      </div>
    </Stop>
  );
}

/* ─────────────────────────── projects ────────────────────────── */

function Projects() {
  return (
    <Stop index={3} side="left" className="rz-section--strip">
      {/* sideways strip: scroll drives it on wide screens, a swipe elsewhere */}
      <div className="rz-strip" tabIndex={0} role="region" aria-label="Projects, scrolls sideways">
        <div className="rz-strip-track">
          {PROJECTS.map((p, i) => (
            <article key={p.id} className="resume-card rz-project">
              <div className="rz-project-num font-hero" aria-hidden="true">
                {String(i + 1).padStart(2, '0')}
              </div>
              <div className="mb-3 flex flex-wrap gap-1.5">
                {p.tags.map((t) => (
                  <span key={t} className="rz-tag font-data">
                    {t}
                  </span>
                ))}
              </div>
              <h3 className="font-hud rz-card-title">{p.title}</h3>
              <p className="rz-card-text flex-1">{p.oneLiner}</p>
              <div className="my-4 flex flex-wrap gap-1.5">
                {p.stack.map((s) => (
                  <TechChip key={s} name={s} />
                ))}
              </div>
              <div className="flex gap-2">
                {p.repo && (
                  <a href={p.repo} target="_blank" rel="noopener noreferrer" className="hud-btn rz-btn rz-btn--sm">
                    <FaGithub size={12} style={{ display: 'inline', marginRight: 6 }} />
                    CODE
                  </a>
                )}
                {p.live && (
                  <a href={p.live} target="_blank" rel="noopener noreferrer" className="hud-btn rz-btn rz-btn--sm">
                    LIVE ↗
                  </a>
                )}
                {!p.repo && !p.live && p.note && (
                  <span className="font-data" style={{ fontSize: '0.6875rem', color: 'var(--text-muted)' }}>
                    {p.note}
                  </span>
                )}
              </div>
            </article>
          ))}
          <a
            href={GITHUB_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="resume-card rz-project rz-project--more"
          >
            <FaGithub size={30} style={{ color: 'var(--accent)' }} />
            <h3 className="font-hud rz-card-title mt-4">MORE ON GITHUB ↗</h3>
            <p className="rz-card-text">
              Those five are the solo builds. Team projects, hackathon work and experiments are on GitHub.
            </p>
          </a>
        </div>
      </div>
      <div className="rz-container">
        <div className="rz-strip-rail" aria-hidden="true">
          <span className="rz-strip-fill" />
          <span className="rz-strip-ship" />
        </div>
        <p className="rz-strip-hint font-data" aria-hidden="true">
          <span className="rz-strip-hint-pin">KEEP SCROLLING — THE BELT DRIFTS PAST</span>
          <span className="rz-strip-hint-swipe">SCROLL SIDEWAYS →</span>
        </p>
      </div>
    </Stop>
  );
}

/* ─────────────────────────── achievements ────────────────────── */

function Achievements() {
  return (
    <Stop index={4} side="right">
      <div className="rz-container">
        <div className="grid gap-4 md:grid-cols-2">
          {ACHIEVEMENTS.map((a, i) => (
            <div key={a.id} className="resume-card rz-beacon flex h-full flex-col p-5" data-rz-reveal>
              <span className="rz-beacon-beam" aria-hidden="true" />
              <div className="rz-card-kicker font-data">
                BEACON {String(i + 1).padStart(2, '0')} · {a.beacon}
              </div>
              <h3 className="font-hud rz-card-title">{a.title}</h3>
              <p className="font-data rz-posting-meta">{a.context}</p>
              <ul className="rz-bullets flex-1">
                {a.bullets.map((b) => (
                  <li key={b.slice(0, 24)}>{b}</li>
                ))}
              </ul>
              {a.link && (
                <a
                  href={a.link.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hud-btn rz-btn rz-btn--sm mt-4 self-start"
                >
                  {a.link.label} ↗
                </a>
              )}
            </div>
          ))}
        </div>
      </div>
    </Stop>
  );
}

/* ─────────────────────────── contact ─────────────────────────── */

type TxState = 'IDLE' | 'SENDING' | 'SENT' | 'ERROR';

function Contact() {
  const [tx, setTx] = useState<TxState>('IDLE');

  const submit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (tx === 'SENDING') return;
    const form = e.currentTarget;
    const data = Object.fromEntries(new FormData(form).entries());
    setTx('SENDING');
    try {
      const res = await fetch('/api/contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error(String(res.status));
      setTx('SENT');
      form.reset();
    } catch {
      setTx('ERROR');
    }
  };

  return (
    <Stop index={5} side="left">
      <div className="rz-container">
        <div className="grid gap-8 md:grid-cols-[1fr_1.4fr]">
          <div>
            <p className="rz-prose" data-rz-reveal>
              Open to interesting problems, collaborations, and good conversations about agents, systems, and
              the web. The channel is always on.
            </p>
            <div className="space-y-3">
              {FREQUENCIES.filter((f) => f.id !== 'site').map((f) => (
                <a
                  key={f.id}
                  href={f.href}
                  target={f.href.startsWith('http') ? '_blank' : undefined}
                  rel="noopener noreferrer"
                  className="resume-card rz-channel"
                  data-rz-reveal
                >
                  <span className="font-hud rz-channel-label">{f.label}</span>
                  <span className="font-data min-w-0 truncate">{f.value} ▸</span>
                </a>
              ))}
              <a href={SITE.resumePdf} download className="resume-card rz-channel" data-rz-reveal>
                <span className="font-hud rz-channel-label">RÉSUMÉ</span>
                <span className="font-data">Download PDF ↓</span>
              </a>
            </div>
          </div>

          <form onSubmit={submit} className="resume-card flex flex-col gap-4 p-6" data-rz-reveal>
            <div className="rz-card-kicker font-data">TRANSMIT</div>
            <div className="grid gap-4 sm:grid-cols-2">
              <input name="name" required placeholder="Your name" className="resume-input font-data" aria-label="Name" />
              <input
                name="email"
                type="email"
                required
                placeholder="Your email"
                className="resume-input font-data"
                aria-label="Email"
              />
            </div>
            <textarea
              name="message"
              required
              rows={5}
              placeholder="Your message…"
              className="resume-input font-data"
              style={{ resize: 'vertical' }}
              aria-label="Message"
            />
            <div className="flex flex-wrap items-center justify-between gap-3">
              <span
                className="font-data"
                role="status"
                style={{
                  fontSize: '0.75rem',
                  color:
                    tx === 'ERROR' ? 'var(--danger)' : tx === 'SENT' ? 'var(--success)' : 'var(--text-secondary)',
                }}
              >
                {tx === 'IDLE' && 'Goes straight to my inbox.'}
                {tx === 'SENDING' && 'Transmitting…'}
                {tx === 'SENT' && 'Message received. Thank you.'}
                {tx === 'ERROR' && 'Could not send. Please use the email link instead.'}
              </span>
              <button type="submit" disabled={tx === 'SENDING'} className="hud-btn rz-btn rz-btn--solid">
                SEND MESSAGE ▸
              </button>
            </div>
          </form>
        </div>
      </div>
    </Stop>
  );
}

/* ─────────────────────────── footer ──────────────────────────── */

function Footer() {
  return (
    <footer className="rz-footer" data-route-host>
      <span data-route-anchor className="rz-footer-end" aria-hidden="true" />
      <p className="font-hero rz-footer-title">ROUTE COMPLETE</p>
      <p className="rz-footer-text">
        That was the flat version. The same route is flyable from a cockpit, with a game at the end of it.
      </p>
      <Link href="/" className="hud-btn rz-btn rz-btn--solid">
        <FaRocket size={11} style={{ display: 'inline', marginRight: 8 }} />
        BOARD THE SHIP
      </Link>
      <div className="mt-8 flex justify-center gap-6">
        {SOCIALS.map(({ id, Icon, href, label }) => (
          <a key={id} href={href} target="_blank" rel="noopener noreferrer" aria-label={label}>
            <Icon size={16} />
          </a>
        ))}
      </div>
      <p className="font-data mt-4" style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
        © {new Date().getFullYear()} Ayush Kumar · transmission ends
      </p>
    </footer>
  );
}

/* ─────────────────────────── root ────────────────────────────── */

export default function ResumeView() {
  const root = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState('home');
  const [waves, setWaves] = useState(false);

  // the page scrolls normally (the 3D site locks the document)
  useEffect(() => {
    document.body.dataset.scroll = 'true';
    return () => {
      delete document.body.dataset.scroll;
    };
  }, []);

  // the hero's WebGL shimmer is an extra: only with WebGL, a wide screen and motion allowed
  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches || window.innerWidth < 900) return;
    try {
      const c = document.createElement('canvas');
      setWaves(!!(c.getContext('webgl2') ?? c.getContext('webgl')));
    } catch {
      setWaves(false);
    }
  }, []);

  // every scroll-driven animation on the page
  useEffect(() => {
    const page = root.current;
    if (!page) return;
    gsap.registerPlugin(ScrollTrigger);
    const mm = gsap.matchMedia(page);

    mm.add(
      {
        motion: '(prefers-reduced-motion: no-preference)',
        // room to hold the projects section and run it sideways
        roomy: '(min-width: 900px) and (min-height: 660px)',
      },
      (ctx) => {
        const { motion, roomy } = ctx.conditions as { motion: boolean; roomy: boolean };
        const all = <T extends Element = HTMLElement>(sel: string) => gsap.utils.toArray<T>(sel, page);

        /* ── projects: held in place while the strip runs sideways ──
           (created first: a pinned section changes where everything below it sits) */
        const projects = page.querySelector<HTMLElement>('#projects');
        const strip = page.querySelector<HTMLElement>('.rz-strip');
        const track = page.querySelector<HTMLElement>('.rz-strip-track');
        if (motion && roomy && projects && strip && track) {
          projects.classList.add('is-pinned');
          const dist = () => Math.max(0, track.scrollWidth - strip.clientWidth);
          const run = gsap.to(track, {
            x: () => -dist(),
            ease: 'none',
            scrollTrigger: {
              trigger: projects,
              start: 'top top',
              end: () => `+=${dist()}`,
              pin: true,
              scrub: 0.6,
              anticipatePin: 1,
              invalidateOnRefresh: true,
              onUpdate: (self) => projects.style.setProperty('--p', self.progress.toFixed(4)),
              // the route line scrolls on underneath a held section, so it steps back
              onToggle: (self) => page.classList.toggle('rz-route-dim', self.isActive),
            },
          });
          all('.rz-project').forEach((card) => {
            gsap.fromTo(
              card,
              { opacity: 0.2, scale: 0.86, rotateY: -14, transformPerspective: 900 },
              {
                opacity: 1,
                scale: 1,
                rotateY: 0,
                ease: 'none',
                scrollTrigger: {
                  trigger: card,
                  containerAnimation: run,
                  start: 'left 96%',
                  end: 'left 58%',
                  scrub: true,
                },
              },
            );
          });
        }

        /* ── which stop is in view: nav highlight + the sky's colour ── */
        all('.rz-hero, .rz-section').forEach((sec) => {
          const spacer = sec.parentElement;
          ScrollTrigger.create({
            trigger: spacer?.classList.contains('pin-spacer') ? spacer : sec,
            start: 'top 55%',
            end: 'bottom 55%',
            onToggle: (self) => {
              if (!self.isActive) return;
              setActive(sec.id);
              if (sec.dataset.accent) setSkyTint(sec.dataset.accent);
            },
          });
        });

        /* ── page progress along the top bar ── */
        gsap.fromTo(
          '.rz-progress',
          { scaleX: 0 },
          { scaleX: 1, ease: 'none', scrollTrigger: { start: 0, end: 'max', scrub: 0.3 } },
        );

        if (!motion) {
          // reduced motion: everything is simply there
          gsap.set('.rz-hide', { opacity: 1 });
          return () => projects?.classList.remove('is-pinned');
        }

        /* ── hero: the ship flies in, the name arrives as streaks ── */
        const intro = gsap.timeline({ defaults: { ease: 'expo.out' } });
        intro
          .fromTo(
            '.rz-hero-ship',
            { opacity: 0, x: 620, y: -160, scale: 0.5, rotate: -8 },
            { opacity: 1, x: 0, y: 0, scale: 1, rotate: 0, duration: 1.9, ease: 'power4.out' },
            0.15,
          )
          .fromTo('.rz-hero-eyebrow', { opacity: 0, x: -24 }, { opacity: 1, x: 0, duration: 0.6 }, 0.25)
          .set('.rz-name', { opacity: 1 }, 0.35)
          .fromTo(
            '.rz-name .rz-char',
            { opacity: 0, x: (i) => 220 + i * 46, scaleX: 5, filter: 'blur(10px)' },
            { opacity: 1, x: 0, scaleX: 1, filter: 'blur(0px)', duration: 1, stagger: 0.05 },
            0.35,
          )
          .fromTo(
            '.rz-hero-line',
            { opacity: 0, y: 18 },
            { opacity: 1, y: 0, duration: 0.7, stagger: 0.12 },
            1.05,
          )
          .fromTo(
            '.rz-portrait',
            { opacity: 0, clipPath: 'inset(0% 0% 100% 0%)' },
            { opacity: 1, clipPath: 'inset(0% 0% 0% 0%)', duration: 1, ease: 'power2.inOut' },
            0.9,
          );
        // idle: the ship breathes on its mooring
        gsap.to('.rz-hero-ship', { y: '+=14', rotate: 1.5, duration: 3.4, ease: 'sine.inOut', yoyo: true, repeat: -1, delay: 2.2 });
        // …and leaves as the page starts to move
        gsap.to('.rz-hero-ship-wrap', {
          xPercent: -70,
          yPercent: -45,
          scale: 0.35,
          opacity: 0,
          ease: 'power1.in',
          scrollTrigger: { trigger: '.rz-hero', start: 'top top', end: 'bottom 30%', scrub: 0.5 },
        });
        gsap.to('.rz-hero-inner', {
          yPercent: -12,
          opacity: 0,
          ease: 'none',
          scrollTrigger: { trigger: '.rz-hero', start: '35% top', end: 'bottom 20%', scrub: true },
        });

        /* ── every stop: the world grows in, the heading assembles ── */
        all('.rz-section').forEach((sec) => {
          const img = sec.querySelector('.rz-planet img');
          const head = sec.querySelector('.rz-head');
          const eyebrow = sec.querySelector<HTMLElement>('.rz-eyebrow');
          if (img) {
            // arrival: from a dot in the distance to its full size
            gsap.fromTo(
              img,
              { scale: 0.05, opacity: 0, rotate: -30 },
              {
                scale: 1,
                opacity: 1,
                rotate: 0,
                ease: 'power1.out',
                scrollTrigger: { trigger: sec, start: 'top 96%', end: 'top 28%', scrub: 0.7 },
              },
            );
            // then it keeps turning slowly for as long as the stop is on screen
            gsap.fromTo(
              img,
              { rotate: 0 },
              {
                rotate: 16,
                ease: 'none',
                immediateRender: false,
                scrollTrigger: { trigger: sec, start: 'top 28%', end: 'bottom top', scrub: 0.7 },
              },
            );
          }
          if (head) {
            gsap
              .timeline({
                scrollTrigger: { trigger: head, start: 'top 84%', toggleActions: 'play none none reverse' },
              })
              .fromTo(
                eyebrow,
                { opacity: 0 },
                { opacity: 1, duration: 0.25, onStart: () => eyebrow && scramble(eyebrow) },
                0,
              )
              .fromTo(
                head.querySelectorAll('.rz-char'),
                { opacity: 0, yPercent: 120, rotateX: -85, transformPerspective: 600 },
                { opacity: 1, yPercent: 0, rotateX: 0, duration: 0.8, stagger: 0.04, ease: 'back.out(1.5)' },
                0.05,
              )
              .fromTo(
                head.querySelector('.rz-rule'),
                { scaleX: 0 },
                { scaleX: 1, duration: 1, ease: 'expo.out' },
                0.25,
              )
              .fromTo(
                head.querySelector('.rz-brief'),
                { opacity: 0, y: 12 },
                { opacity: 1, y: 0, duration: 0.6, ease: 'power2.out' },
                0.45,
              );
          }
        });

        /* ── cards and paragraphs dock in as they come into view ── */
        const reveals = all('[data-rz-reveal]');
        gsap.set(reveals, { opacity: 0, y: 46 });
        ScrollTrigger.batch(reveals, {
          start: 'top 90%',
          onEnter: (batch) =>
            gsap.to(batch, { opacity: 1, y: 0, duration: 0.85, stagger: 0.09, ease: 'expo.out', overwrite: true }),
          onLeaveBack: (batch) =>
            gsap.to(batch, { opacity: 0, y: 46, duration: 0.3, stagger: 0.03, ease: 'power1.in', overwrite: true }),
        });

        /* ── numbers count up ── */
        all('[data-rz-count]').forEach((el) => {
          const to = Number(el.dataset.rzCount);
          const decimals = Number(el.dataset.decimals ?? 0);
          const o = { v: 0 };
          el.textContent = (0).toFixed(decimals);
          gsap.to(o, {
            v: to,
            duration: 1.8,
            ease: 'power2.out',
            onUpdate: () => {
              el.textContent = o.v.toFixed(decimals);
            },
            scrollTrigger: { trigger: el, start: 'top 90%', once: true },
          });
        });

        /* ── experience: the lane fills as you pass each posting ── */
        const timeline = page.querySelector('.rz-timeline');
        if (timeline) {
          gsap.fromTo(
            '.rz-timeline-fill',
            { scaleY: 0 },
            {
              scaleY: 1,
              ease: 'none',
              scrollTrigger: { trigger: timeline, start: 'top 62%', end: 'bottom 62%', scrub: 0.4 },
            },
          );
          all('.rz-posting').forEach((li) => {
            gsap
              .timeline({
                scrollTrigger: { trigger: li, start: 'top 80%', toggleActions: 'play none none reverse' },
              })
              .fromTo(
                li.querySelector('.rz-posting-node'),
                { scale: 0 },
                { scale: 1, duration: 0.5, ease: 'back.out(3)' },
                0,
              )
              .fromTo(
                li.querySelector('.resume-card'),
                { opacity: 0, x: 70, skewX: -4 },
                { opacity: 1, x: 0, skewX: 0, duration: 0.9, ease: 'expo.out' },
                0.05,
              )
              .fromTo(
                li.querySelectorAll('.tech-chip'),
                { opacity: 0, y: 10 },
                { opacity: 1, y: 0, duration: 0.4, stagger: 0.03, ease: 'power2.out' },
                0.35,
              );
          });
        }

        /* ── achievements: each beacon's beam lights ── */
        all('.rz-beacon-beam').forEach((beam) => {
          gsap.fromTo(
            beam,
            { scaleY: 0, opacity: 0 },
            {
              scaleY: 1,
              opacity: 1,
              duration: 1.1,
              ease: 'expo.out',
              scrollTrigger: { trigger: beam.parentElement, start: 'top 82%', toggleActions: 'play none none reverse' },
            },
          );
        });

        /* ── the jumps between stops: the label flares and passes (the sky stays still) ── */
        all('.rz-jump').forEach((jump) => {
          gsap
            .timeline({ scrollTrigger: { trigger: jump, start: 'top 92%', end: 'bottom 8%', scrub: 0.5 } })
            .fromTo(
              jump.querySelector('.rz-jump-label'),
              { opacity: 0, scale: 0.7, letterSpacing: '0.05em', filter: 'blur(8px)' },
              { opacity: 1, scale: 1, letterSpacing: '0.5em', filter: 'blur(0px)', ease: 'power2.out', duration: 1 },
              0,
            )
            .fromTo(jump.querySelectorAll('.rz-jump-line'), { scaleX: 0 }, { scaleX: 1, ease: 'power2.out', duration: 1 }, 0)
            .to(
              jump.querySelector('.rz-jump-label'),
              { opacity: 0, scale: 1.5, filter: 'blur(8px)', ease: 'power2.in', duration: 1 },
              1,
            )
            .to(jump.querySelectorAll('.rz-jump-line'), { scaleX: 3, opacity: 0, ease: 'power2.in', duration: 1 }, 1);
        });

        return () => {
          projects?.classList.remove('is-pinned');
          page.classList.remove('rz-route-dim');
          projects?.style.removeProperty('--p');
        };
      },
    );

    // layout shifts once the web fonts land: re-measure everything
    document.fonts?.ready.then(() => ScrollTrigger.refresh());
    // a link straight to a section
    const hash = window.location.hash.slice(1);
    if (hash) requestAnimationFrame(() => flyTo(hash, false));

    return () => mm.revert();
  }, []);

  return (
    <div ref={root} className="resume-page rz-page">
      <noscript>
        <style>{'.rz-hide{opacity:1 !important}'}</style>
      </noscript>
      <Starfield2D />
      <Route root={root} />
      <div className="canopy-scanlines pointer-events-none fixed inset-0" style={{ zIndex: 60 }} aria-hidden />
      <Navbar active={active} />
      <Rail active={active} />
      <main>
        <Hero waves={waves} />
        <About />
        <Jump to={1} />
        <Skills />
        <Jump to={2} />
        <Experience />
        <Jump to={3} />
        <Projects />
        <Jump to={4} />
        <Achievements />
        <Jump to={5} />
        <Contact />
      </main>
      <Footer />
    </div>
  );
}
