'use client';

import Link from 'next/link';
import dynamic from 'next/dynamic';
import {
  FormEvent,
  ReactNode,
  useEffect,
  useRef,
  useState,
} from 'react';
import { FaBars, FaXmark, FaGithub, FaLinkedinIn, FaEnvelope, FaRocket } from 'react-icons/fa6';
import { SITE, FREQUENCIES } from '@/content/site';
import { DOSSIER } from '@/content/bio';
import { EXPERIENCE, ExperienceNode } from '@/content/experience';
import { EDUCATION } from '@/content/education';
import { PROJECTS } from '@/content/projects';
import { SKILL_GROUPS, TECH } from './techMap';

// WebGL line-waves background for the hero (ReactBits) — client-only
const LineWaves = dynamic(() => import('./LineWaves'), { ssr: false });

/* ─────────────────────────── helpers ─────────────────────────── */

const NAV_LINKS = [
  { href: '#about', label: 'About' },
  { href: '#skills', label: 'Skills' },
  { href: '#projects', label: 'Projects' },
  { href: '#experience', label: 'Experience' },
  { href: '#keyroles', label: 'Key Roles' },
  { href: '#education', label: 'Education' },
  { href: '#contact', label: 'Contact' },
];

const SOCIALS = [
  { id: 'github', Icon: FaGithub, href: 'https://github.com/AyushK0808', label: 'GitHub' },
  {
    id: 'linkedin',
    Icon: FaLinkedinIn,
    href: 'https://www.linkedin.com/in/ayushk0808',
    label: 'LinkedIn',
  },
  { id: 'email', Icon: FaEnvelope, href: `mailto:${SITE.email}`, label: 'Email' },
];

/** terminal decode effect, store-free so the résumé bundle stays light */
function useDecode(text: string, msPerChar = 45): string {
  const [out, setOut] = useState('');
  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      setOut(text);
      return;
    }
    const GLYPHS = '▚▞░▒#$%<>[]/01';
    let i = 0;
    const iv = window.setInterval(() => {
      i++;
      if (i >= text.length) {
        setOut(text);
        window.clearInterval(iv);
        return;
      }
      let scramble = '';
      for (let j = 0; j < Math.min(3, text.length - i); j++) {
        scramble += GLYPHS[Math.floor(Math.random() * GLYPHS.length)];
      }
      setOut(text.slice(0, i) + scramble);
    }, msPerChar);
    return () => window.clearInterval(iv);
  }, [text, msPerChar]);
  return out;
}

/** fade-slide in when scrolled into view */
function Reveal({
  children,
  delay = 0,
  className = '',
}: {
  children: ReactNode;
  delay?: number;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          el.classList.add('is-visible');
          io.disconnect();
        }
      },
      { threshold: 0.12, rootMargin: '0px 0px -40px 0px' },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);
  return (
    <div ref={ref} className={`reveal ${className}`} style={{ '--reveal-delay': `${delay}ms` } as React.CSSProperties}>
      {children}
    </div>
  );
}

function Section({
  id,
  title,
  children,
}: {
  id: string;
  title: string;
  children: ReactNode;
}) {
  return (
    <section id={id} className="mx-auto w-full max-w-5xl px-5 py-14 md:px-8 md:py-20">
      <Reveal>
        <h2
          className="resume-heading font-hud mb-8 md:mb-12"
          style={{ color: 'var(--text-primary)', fontSize: 'clamp(1.25rem, 3vw, 1.75rem)' }}
        >
          {title}
        </h2>
      </Reveal>
      {children}
    </section>
  );
}

function TechChip({ name }: { name: string }) {
  const meta = TECH[name];
  return (
    <span
      className="tech-chip font-data"
      style={meta ? ({ '--chip-color': meta.color } as React.CSSProperties) : undefined}
    >
      {meta && <meta.Icon size={14} aria-hidden />}
      {name}
    </span>
  );
}

/* ─────────────────────────── navbar ──────────────────────────── */

function Navbar() {
  const [open, setOpen] = useState(false);

  return (
    <>
      <nav className="resume-nav fixed left-0 top-0 z-50 w-full">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-5 py-4 md:px-8">
          <a
            href="#home"
            className="font-hero"
            style={{ fontSize: '0.95rem', color: 'var(--text-primary)', letterSpacing: '0.2em' }}
          >
            AYUSH<span style={{ color: 'var(--hud-cyan)' }}> KUMAR</span>
          </a>

          {/* desktop links */}
          <div className="hidden items-center gap-6 lg:flex">
            {NAV_LINKS.map((l) => (
              <a key={l.href} href={l.href} className="resume-nav-link font-hud" style={{ fontSize: '0.6875rem' }}>
                {l.label}
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
          transition: 'transform 320ms var(--ease-hud-in)',
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
        {NAV_LINKS.map((l, i) => (
          <a
            key={l.href}
            href={l.href}
            onClick={() => setOpen(false)}
            className="resume-nav-link font-hud py-2"
            style={{
              fontSize: '0.8125rem',
              transform: open ? 'translateX(0)' : 'translateX(24px)',
              opacity: open ? 1 : 0,
              transition: `all 300ms var(--ease-hud-in) ${80 + i * 45}ms`,
            }}
          >
            {l.label}
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

/* ─────────────────────────── hero ────────────────────────────── */

function Hero() {
  return (
    <section id="home" className="relative flex min-h-[92vh] w-full flex-col justify-center overflow-hidden">
      {/* ReactBits line waves, tinted to the deck palette, faded out at the bottom */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          zIndex: 0,
          opacity: 0.85,
          WebkitMaskImage: 'linear-gradient(to bottom, black 55%, transparent 100%)',
          maskImage: 'linear-gradient(to bottom, black 55%, transparent 100%)',
        }}
      >
        <LineWaves
          color1="#00D9F5"
          color2="#B266FF"
          color3="#2FE0C8"
          speed={0.25}
          brightness={0.3}
          warpIntensity={0.9}
        />
      </div>
      {/* readability veil so the dossier text stays crisp over the light */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          zIndex: 1,
          background:
            'radial-gradient(120% 90% at 20% 40%, transparent 0%, rgba(5,6,10,0.55) 70%, var(--void) 100%)',
        }}
      />

      <div className="relative z-10 mx-auto w-full max-w-5xl px-5 pt-24 md:px-8">
        <p className="font-data animate-hud-in mb-4" style={{ color: 'var(--hud-cyan)', fontSize: '0.8125rem' }}>
          {'> transmission incoming — pilot dossier'}
        </p>
        <h1
          className="hero-name font-hero animate-hud-in"
          style={{ fontSize: 'clamp(2.4rem, 8vw, 5rem)', lineHeight: 1.05, animationDelay: '120ms' }}
        >
          AYUSH KUMAR
        </h1>
        {/* <p
          className="font-hud animate-hud-in mt-5"
          style={{ color: 'var(--text-secondary)', fontSize: 'clamp(0.8125rem, 2vw, 1rem)', minHeight: '1.5em', animationDelay: '240ms' }}
        >
          {tagline || ' '}
        </p> */}
        <p className="font-data animate-hud-in mt-2" style={{ color: 'var(--text-muted)', fontSize: '0.8125rem', animationDelay: '320ms' }}>
          {DOSSIER.rank} · {DOSSIER.posting} · {DOSSIER.origin}
        </p>
        <div className="animate-hud-in mt-8 flex flex-wrap gap-3" style={{ animationDelay: '420ms' }}>
          <a href="#contact" className="hud-btn" style={{ fontSize: '0.8125rem', padding: '11px 24px' }}>
            GET IN TOUCH ▸
          </a>
          <Link href="/" className="hud-btn" style={{ fontSize: '0.8125rem', padding: '11px 24px' }}>
            <FaRocket size={11} style={{ display: 'inline', marginRight: 8 }} />
            FLY THE 3D VERSION
          </Link>
        </div>
      </div>
    </section>
  );
}

/* ─────────────────────────── about ───────────────────────────── */

function About() {
  return (
    <Section id="about" title="About Me">
      <div className="grid gap-10 md:grid-cols-[2fr_1fr]">
        <div>
          {DOSSIER.bio.map((p, i) => (
            <Reveal key={p.slice(0, 24)} delay={i * 120}>
              <p className="mb-4 leading-relaxed" style={{ color: 'var(--text-secondary)', fontSize: '0.95rem' }}>
                {p}
              </p>
            </Reveal>
          ))}
        </div>
        <Reveal delay={200}>
          <div className="resume-card p-5">
            <div className="font-hud mb-3" style={{ color: 'var(--hud-cyan)', fontSize: '0.6875rem' }}>
              SPECIALTIES
            </div>
            <div className="flex flex-wrap gap-2">
              {DOSSIER.traits.map((t) => (
                <span key={t} className="tech-chip font-data">
                  {t}
                </span>
              ))}
            </div>
            <div className="font-data mt-5 space-y-1" style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
              <div>GPA — {DOSSIER.gpa}</div>
              <div>ISDC 2024 — 1ST PLACE (SOFTWARE LEAD)</div>
              <div>ICACKE 2026 — PUBLISHED RESEARCH</div>
            </div>
          </div>
        </Reveal>
      </div>
    </Section>
  );
}

/* ─────────────────────────── skills ──────────────────────────── */

function Skills() {
  return (
    <Section id="skills" title="My Skills">
      <div className="grid gap-4 md:grid-cols-3">
        {SKILL_GROUPS.map((g, i) => (
          <Reveal key={g.id} delay={i * 90} className={g.span === 2 ? 'md:col-span-2' : ''}>
            <div className="resume-card h-full p-5">
              <div className="font-hud mb-4" style={{ color: 'var(--text-primary)', fontSize: '0.8125rem' }}>
                {g.title}
              </div>
              <div className="flex flex-wrap gap-2">
                {g.items.map((item) => (
                  <TechChip key={item} name={item} />
                ))}
              </div>
            </div>
          </Reveal>
        ))}
      </div>
    </Section>
  );
}

/* ─────────────────────────── projects ────────────────────────── */

function Projects() {
  return (
    <Section id="projects" title="My Projects">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {PROJECTS.map((p, i) => (
          <Reveal key={p.id} delay={(i % 3) * 100}>
            <div className="resume-card flex h-full flex-col p-5">
              <div className="mb-2 flex flex-wrap gap-1.5">
                {p.tags.map((t) => (
                  <span
                    key={t}
                    className="font-data"
                    style={{
                      fontSize: '0.625rem',
                      color: 'var(--hud-cyan)',
                      border: '1px solid var(--hud-cyan-dim)',
                      borderRadius: 999,
                      padding: '2px 8px',
                    }}
                  >
                    {t}
                  </span>
                ))}
              </div>
              <h3 className="font-hud mb-2" style={{ color: 'var(--text-primary)', fontSize: '0.875rem' }}>
                {p.title}
              </h3>
              <p className="mb-4 flex-1 leading-relaxed" style={{ color: 'var(--text-secondary)', fontSize: '0.8125rem' }}>
                {p.oneLiner}
              </p>
              <div className="mb-3 flex flex-wrap gap-1.5">
                {p.stack.map((s) => (
                  <TechChip key={s} name={s} />
                ))}
              </div>
              <div className="flex gap-2">
                {p.repo && (
                  <a href={p.repo} target="_blank" rel="noopener noreferrer" className="hud-btn" style={{ fontSize: '0.625rem' }}>
                    <FaGithub size={11} style={{ display: 'inline', marginRight: 5 }} />
                    CODE
                  </a>
                )}
                {p.live && (
                  <a href={p.live} target="_blank" rel="noopener noreferrer" className="hud-btn" style={{ fontSize: '0.625rem' }}>
                    LIVE ↗
                  </a>
                )}
                {!p.repo && !p.live && p.note && (
                  <span className="font-data" style={{ fontSize: '0.625rem', color: 'var(--text-muted)' }}>
                    {p.note}
                  </span>
                )}
              </div>
            </div>
          </Reveal>
        ))}
      </div>
    </Section>
  );
}

/* ─────────────────────────── timeline ────────────────────────── */

interface TimelineItem {
  id: string;
  head: string;
  sub: string;
  dates: string;
  body: ReactNode;
  tech?: string[];
  link?: { label: string; href: string };
}

/** vertical timeline with a scroll-linked progress line, old-site style */
function Timeline({ items }: { items: TimelineItem[] }) {
  const wrap = useRef<HTMLDivElement>(null);
  const bar = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onScroll = () => {
      const el = wrap.current;
      const line = bar.current;
      if (!el || !line) return;
      const rect = el.getBoundingClientRect();
      const vh = window.innerHeight;
      const progress = Math.min(1, Math.max(0, (vh * 0.75 - rect.top) / rect.height));
      line.style.transform = `scaleY(${progress})`;
    };
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll);
    return () => {
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onScroll);
    };
  }, []);

  return (
    <div ref={wrap} className="timeline mx-auto w-full max-w-3xl">
      <div className="timeline-track" />
      <div ref={bar} className="timeline-progress" />
      <ul className="flex flex-col gap-10">
        {items.map((item, i) => (
          <li key={item.id} className="relative">
            <span className="timeline-node" aria-hidden />
            <Reveal delay={i * 80}>
              <h3
                className="font-hud"
                style={{ color: 'var(--text-primary)', fontSize: 'clamp(0.9rem, 2vw, 1.05rem)' }}
              >
                {item.head}
                <span style={{ color: 'var(--hud-cyan)' }}> · {item.sub}</span>
              </h3>
              <p className="font-data mb-2 mt-1" style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                {item.dates}
                {item.link && (
                  <>
                    {' · '}
                    <a href={item.link.href} target="_blank" rel="noopener noreferrer">
                      {item.link.label} ↗
                    </a>
                  </>
                )}
              </p>
              <div className="leading-relaxed" style={{ color: 'var(--text-secondary)', fontSize: '0.875rem' }}>
                {item.body}
              </div>
              {item.tech && (
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {item.tech.map((t) => (
                    <TechChip key={t} name={t} />
                  ))}
                </div>
              )}
            </Reveal>
          </li>
        ))}
      </ul>
    </div>
  );
}

function expToItem(e: ExperienceNode): TimelineItem {
  return {
    id: e.id,
    head: e.role,
    sub: e.org,
    dates: `${e.dates} · ${e.location}`,
    tech: e.tech,
    link: e.link,
    body: (
      <ul className="list-disc space-y-1 pl-5">
        {e.bullets.map((b) => (
          <li key={b.slice(0, 24)}>{b}</li>
        ))}
      </ul>
    ),
  };
}

function WorkExperience() {
  const items = EXPERIENCE.filter((e) => e.kind === 'work')
    .slice()
    .reverse()
    .map(expToItem);
  return (
    <Section id="experience" title="Work Experience">
      <Timeline items={items} />
    </Section>
  );
}

function KeyRoles() {
  const items = EXPERIENCE.filter((e) => e.kind === 'leadership')
    .slice()
    .reverse()
    .map(expToItem);
  return (
    <Section id="keyroles" title="Key Roles">
      <Timeline items={items} />
    </Section>
  );
}

function Education() {
  const items: TimelineItem[] = EDUCATION.map((e) => ({
    id: e.id,
    head: e.degree,
    sub: e.institute,
    dates: `${e.dates} · ${e.grade}`,
    body: <p>{e.details}</p>,
  }));
  return (
    <Section id="education" title="Education">
      <Timeline items={items} />
    </Section>
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
    <Section id="contact" title="Get in Touch">
      <div className="grid gap-10 md:grid-cols-[1fr_1.4fr]">
        <Reveal>
          <div>
            <p className="mb-6 leading-relaxed" style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
              Open to interesting problems, collaborations, and good conversations
              about agents, systems, and the web. The channel is always on.
            </p>
            <div className="space-y-3">
              {FREQUENCIES.map((f) => (
                <a
                  key={f.id}
                  href={f.href}
                  target={f.href.startsWith('http') ? '_blank' : undefined}
                  rel="noopener noreferrer"
                  className="resume-card flex items-center justify-between p-3.5"
                >
                  <span className="font-hud" style={{ fontSize: '0.6875rem', color: 'var(--text-muted)' }}>
                    {f.label}
                  </span>
                  <span className="font-data" style={{ fontSize: '0.8125rem' }}>
                    {f.value} ▸
                  </span>
                </a>
              ))}
            </div>
          </div>
        </Reveal>

        <Reveal delay={150}>
          <form onSubmit={submit} className="resume-card flex flex-col gap-4 p-6">
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
              <span className="font-data" style={{ fontSize: '0.75rem', color: tx === 'ERROR' ? 'var(--danger)' : tx === 'SENT' ? 'var(--success)' : 'var(--text-muted)' }}>
                {tx === 'IDLE' && '> awaiting input _'}
                {tx === 'SENDING' && '> transmitting…'}
                {tx === 'SENT' && '> message received — I’ll get back to you soon ✓'}
                {tx === 'ERROR' && '> send failed — email me directly instead.'}
              </span>
              <button type="submit" disabled={tx === 'SENDING'} className="hud-btn" style={{ fontSize: '0.8125rem', padding: '10px 26px' }}>
                SEND MESSAGE ▸
              </button>
            </div>
          </form>
        </Reveal>
      </div>
    </Section>
  );
}

/* ─────────────────────────── footer ──────────────────────────── */

function Footer() {
  return (
    <footer
      className="mt-10 border-t px-5 py-8 text-center"
      style={{ borderColor: 'var(--panel-edge)' }}
    >
      <div className="mb-3 flex justify-center gap-6">
        {SOCIALS.map(({ id, Icon, href, label }) => (
          <a key={id} href={href} target="_blank" rel="noopener noreferrer" aria-label={label}>
            <Icon size={16} />
          </a>
        ))}
      </div>
      <p className="font-data" style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
        © {new Date().getFullYear()} Ayush Kumar · transmission ends ·{' '}
        <Link href="/">return to the bridge →</Link>
      </p>
    </footer>
  );
}

/* ─────────────────────────── root ────────────────────────────── */

export default function ResumeView() {
  useEffect(() => {
    document.body.dataset.scroll = 'true';
    return () => {
      delete document.body.dataset.scroll;
    };
  }, []);

  return (
    <div className="resume-page">
      <Navbar />
      <Hero />
      <About />
      <Skills />
      <Projects />
      <WorkExperience />
      <KeyRoles />
      <Education />
      <Contact />
      <Footer />
    </div>
  );
}
