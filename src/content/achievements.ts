// Achievements stop (Cairn) — one beacon each. Every line here is regrouped
// from facts already stated in experience.ts / projects.ts / education.ts.

export interface Achievement {
  id: string;
  /** short label for the in-world beacon */
  beacon: string;
  title: string;
  context: string;
  bullets: string[];
  link?: { label: string; href: string };
}

export const ACHIEVEMENTS: Achievement[] = [
  {
    id: 'isdc',
    beacon: 'ISDC 2024',
    title: 'ISDC 2024 — FIRST PLACE',
    context: 'International Space Drone Challenge · Team Ardra, Software Lead',
    bullets: [
      'Won the International Space Drone Challenge as Software Lead.',
      'Built the end-to-end autonomous pipeline: YOLO / SegFormer / SAM vision, SLAM mapping, onboard comms.',
      'Edge inference and system integration on Raspberry Pi and Jetson Nano.',
    ],
  },
  {
    id: 'icacke',
    beacon: 'ICACKE 2026',
    title: 'ICACKE 2026 — PAPER ACCEPTED',
    context: 'Research · sentiment-augmented financial advisor',
    bullets: [
      'Market indicators + investor profiling + news sentiment, combined into explainable buy / hold / sell calls.',
      'Runs on a local LLM (LLaMA 3.2) with RAG.',
    ],
    link: { label: 'OPEN REPO', href: 'https://github.com/AyushK0808/financial-advisor' },
  },
  {
    id: 'viit',
    beacon: 'VINNOVATEIT',
    title: 'VINNOVATEIT — TECHNICAL HEAD',
    context: '2023 — 2025 · VIT Vellore',
    bullets: [
      'Deployed production apps on Cloudflare + AWS serving 30k+ active users across campus.',
      'Mentored 200+ members across AI/ML, web and core programming; led 15+ full-stack projects end to end.',
    ],
    link: { label: 'WEB25.VINNOVATEIT.COM', href: 'https://web25.vinnovateit.com' },
  },
  {
    id: 'events',
    beacon: 'VINHACK · VIT MUN',
    title: 'VINHACK & VIT MUN',
    context: 'Organiser · Under Secretary General, Technology',
    bullets: [
      'Organized VinHack, a nationwide hackathon with 300+ participants.',
      'Built and deployed the VITMUN 2025 platform serving 1,000+ users (Next.js, Docker on a VM).',
    ],
    link: { label: 'VITMUN-25.VERCEL.APP', href: 'https://vitmun-25.vercel.app' },
  },
];
