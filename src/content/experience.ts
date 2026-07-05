// Trajectory Corridor (Mission B) — outposts strung chronologically along the
// flight path. Positions are assigned by the sector layout, not here.

export interface ExperienceNode {
  id: string;
  org: string;
  role: string;
  dates: string;
  location: string;
  kind: 'education' | 'work' | 'leadership';
  bullets: string[];
  tech: string[];
  link?: { label: string; href: string };
}

export const EXPERIENCE: ExperienceNode[] = [
  {
    id: 'vit',
    org: 'VIT VELLORE',
    role: 'B.Tech Computer Science & Engineering',
    dates: '2022 — 2026',
    location: 'Vellore, India',
    kind: 'education',
    bullets: [
      'GPA 9.35 / 10.0.',
      'Research accepted at ICACKE 2026 (sentiment-augmented financial advisor).',
      'Launch site for everything below.',
    ],
    tech: ['CS fundamentals', 'ML', 'Research'],
  },
  {
    id: 'titan',
    org: 'TITAN SMART LABS',
    role: 'Algorithm Intern — Smart Wearables',
    dates: 'Jun 2024 — Aug 2024',
    location: 'Hyderabad, India',
    kind: 'work',
    bullets: [
      'Built end-to-end preprocessing for multimodal physiological time-series (heart rate + accelerometer) from an in-house smartwatch: filtering, sync, imputation, segmentation, feature engineering.',
      'Improved sleep/stress classification with leave-one-subject-out CV, tuning, and ROC/PR benchmarking.',
    ],
    tech: ['Python', 'NumPy', 'Pandas', 'SciPy', 'Scikit-learn'],
  },
  {
    id: 'ardra',
    org: 'TEAM ARDRA',
    role: 'Software Lead — Autonomous Drones',
    dates: '2023 — 2025',
    location: 'VIT Vellore',
    kind: 'leadership',
    bullets: [
      'Won the International Space Drone Challenge (ISDC 2024) as Software Lead — first place.',
      'Built the end-to-end autonomous pipeline: YOLO / SegFormer / SAM vision, SLAM mapping, onboard comms.',
      'Edge inference and system integration on Raspberry Pi and Jetson Nano; ROS, MAVProxy, Linux.',
    ],
    tech: ['ROS', 'YOLO', 'SAM', 'SLAM', 'Jetson', 'MAVProxy'],
  },
  {
    id: 'vitmun',
    org: 'VIT MUN SOCIETY',
    role: 'Under Secretary General — Technology',
    dates: 'Jan 2024 — Apr 2024',
    location: 'VIT Vellore',
    kind: 'leadership',
    bullets: [
      'Ran the technology for VITMUN — built and shipped the conference website end to end.',
      'Later designed, built and deployed the VITMUN 2025 platform serving 1,000+ users (Next.js, Docker on a VM).',
      'Active in the registrations department that made the conference a success.',
    ],
    tech: ['Next.js', 'Docker'],
    link: { label: 'vitmun-25.vercel.app', href: 'https://vitmun-25.vercel.app' },
  },
  {
    id: 'samsung',
    org: 'SAMSUNG R&D',
    role: 'Research Intern — ML & Generative AI',
    dates: 'Sep 2024 — Jun 2025',
    location: 'Remote',
    kind: 'work',
    bullets: [
      'End-to-end customer segmentation on enterprise datasets: RFM modeling, CLV estimation (BG/NBD & Gamma-Gamma), K-Means/K-Medoids clustering.',
      'Built a GenAI workflow converting segment outputs into executable SQL — automated audience selection and campaign targeting.',
    ],
    tech: ['Python', 'Scikit-learn', 'Statsmodels', 'Lifetimes', 'GenAI'],
  },
  {
    id: 'viit',
    org: 'VINNOVATEIT',
    role: 'Technical Head',
    dates: '2023 — 2025',
    location: 'VIT Vellore',
    kind: 'leadership',
    bullets: [
      'Deployed production apps on Cloudflare + AWS serving 30k+ active users across campus.',
      'Mentored 200+ members across AI/ML, web, and core programming; led 15+ full-stack projects end-to-end.',
      'Organized VinHack — nationwide hackathon, 300+ participants.',
    ],
    tech: ['Cloudflare', 'AWS', 'Next.js', 'Mentorship'],
    link: { label: 'web25.vinnovateit.com', href: 'https://web25.vinnovateit.com' },
  },
  {
    id: 'deloitte',
    org: 'DELOITTE USI',
    role: 'SDE Intern — AI & Backend',
    dates: 'Jun 2025 — Aug 2025',
    location: 'Hyderabad, India',
    kind: 'work',
    bullets: [
      'Backend services for an AI-enabled internal productivity tool using FastAPI.',
      'RESTful microservices, containerized with Docker.',
      '90%+ code coverage with PyTest across deployments.',
    ],
    tech: ['FastAPI', 'Docker', 'PyTest', 'Microservices'],
  },
  {
    id: 'csod',
    org: 'CORNERSTONE ONDEMAND',
    role: 'Junior Engineer',
    dates: 'Dec 2025 — Present',
    location: 'Mumbai, India',
    kind: 'work',
    bullets: [
      'CSX Scheduler — enterprise distributed job orchestration on .NET: REST APIs, job lifecycle, retries, React ops dashboards across AWS EC2 fleets.',
      'Mass PDF pipeline for HR onboarding — Python transformation engine + Rust parallel renderer, live in 22+ production regions.',
      'CSOD Harness — LLM engineering assistant with Roslyn code indexing, a code–infra knowledge graph, and multi-model agent orchestration; −56% token use in multi-repo incident debugging.',
    ],
    tech: ['.NET', 'React', 'Rust', 'Python', 'AWS', 'LLM agents'],
  },
];
