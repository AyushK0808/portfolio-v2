import { LocationId } from '@/lib/theme';
import { FLIGHT, GITHUB_STOP_ID } from '@/systems/flightplan';
import { DOSSIER, HOW_I_WORK, INTERESTS } from '@/content/bio';
import { EDUCATION } from '@/content/education';
import { SKILLS } from '@/content/skills';
import { WORK } from '@/content/experience';
import { PROJECTS, GITHUB_URL } from '@/content/projects';
import { ACHIEVEMENTS } from '@/content/achievements';

/**
 * What the content card shows at each stop. Pure data: the card component
 * renders any of these the same way, so every stop reads consistently.
 */
export interface CardData {
  /** small line above the title: where you are in the sequence */
  eyebrow: string;
  title: string;
  subtitle?: string;
  /** dates, place, status */
  meta?: string;
  /** portrait image path (About only) */
  photo?: string;
  /** face position (% from left / top) and zoom for the portrait crop */
  photoFocus?: { x: number; y: number; zoom: number };
  paragraphs?: string[];
  bullets?: string[];
  chipsLabel?: string;
  chips?: readonly string[];
  links?: { label: string; href: string }[];
}

const nn = (i: number, total: number) =>
  `${String(i + 1).padStart(2, '0')}/${String(total).padStart(2, '0')}`;

export function cardFor(location: LocationId, stop: number): CardData | null {
  const plan = FLIGHT[location];
  if (!plan.hasCards) return null;
  const s = plan.stops[stop];
  if (!s) return null;

  switch (location) {
    case 'ABOUT': {
      if (s.id === 'pilot-id') {
        return {
          eyebrow: 'PILOT RECORD',
          title: DOSSIER.callsign,
          subtitle: `${DOSSIER.rank} · ${DOSSIER.posting}`,
          meta: `STATUS — ${DOSSIER.status}`,
          photo: DOSSIER.photo,
          photoFocus: DOSSIER.photoFocus,
          paragraphs: [...DOSSIER.short],
        };
      }
      if (s.id === 'method') {
        return {
          eyebrow: 'FIELD NOTES',
          title: HOW_I_WORK.title,
          subtitle: HOW_I_WORK.subtitle,
          bullets: [...HOW_I_WORK.bullets],
          chips: HOW_I_WORK.chips,
        };
      }
      if (s.id === 'interests') {
        return {
          eyebrow: 'ON THE RADAR',
          title: INTERESTS.title,
          subtitle: INTERESTS.subtitle,
          bullets: [...INTERESTS.bullets],
          chips: INTERESTS.chips,
        };
      }
      const edu = EDUCATION[0];
      return {
        eyebrow: 'ORIGIN',
        title: 'VIT VELLORE',
        subtitle: edu.degree,
        meta: `${edu.dates} · ${edu.grade}`,
        paragraphs: [edu.details],
        chipsLabel: 'FOCUS',
        chips: DOSSIER.traits,
      };
    }

    case 'SKILLS': {
      const g = SKILLS[stop];
      if (!g) return null;
      return {
        eyebrow: `DOCK ${nn(stop, SKILLS.length)} · ${g.system}`,
        title: g.domain,
        chips: g.items,
        paragraphs: [g.proof],
      };
    }

    case 'EXPERIENCE': {
      const e = WORK[stop];
      if (!e) return null;
      return {
        eyebrow: `POSTING ${nn(stop, WORK.length)}`,
        title: e.org,
        subtitle: e.role,
        meta: `${e.dates} · ${e.location}`,
        bullets: e.bullets,
        chips: e.tech,
        links: e.link ? [{ label: e.link.label.toUpperCase(), href: e.link.href }] : undefined,
      };
    }

    case 'PROJECTS': {
      if (s.id === GITHUB_STOP_ID) {
        return {
          eyebrow: 'SIGNAL BUOY',
          title: 'MORE ON GITHUB',
          paragraphs: [
            'Those five are the solo builds. Team projects, hackathon work and experiments are on GitHub.',
          ],
          links: [{ label: 'GITHUB.COM/AYUSHK0808', href: GITHUB_URL }],
        };
      }
      const p = PROJECTS.find((x) => x.id === s.id);
      if (!p) return null;
      const links: { label: string; href: string }[] = [];
      if (p.repo) links.push({ label: 'OPEN REPO', href: p.repo });
      if (p.live) links.push({ label: 'LIVE', href: p.live });
      return {
        eyebrow: `BUILD ${nn(stop, PROJECTS.length)} · ${p.tags.join(' · ')}`,
        title: p.title,
        paragraphs: [p.oneLiner],
        chips: p.stack,
        links,
      };
    }

    case 'ACHIEVEMENTS': {
      const a = ACHIEVEMENTS[stop];
      if (!a) return null;
      return {
        eyebrow: `BEACON ${nn(stop, ACHIEVEMENTS.length)}`,
        title: a.title,
        subtitle: a.context,
        bullets: a.bullets,
        links: a.link ? [a.link] : undefined,
      };
    }

    default:
      return null;
  }
}
