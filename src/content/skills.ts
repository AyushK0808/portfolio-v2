// Skills → Ship Subsystems map (Mission A). Proficiency 0–100 drives the
// emissive bar fill on each subsystem tile.

export interface Subsystem {
  id: string;
  system: string;
  domain: string;
  level: number;
  items: string[];
  detail: string;
}

export const SUBSYSTEMS: Subsystem[] = [
  {
    id: 'propulsion',
    system: 'PROPULSION',
    domain: 'Frontend & Web',
    level: 92,
    items: ['TypeScript', 'React', 'Next.js', 'Tailwind', 'Three.js'],
    detail:
      'Primary drive. Production dashboards at CSOD, 15+ full-stack builds at VinnovateIT serving 30k+ users.',
  },
  {
    id: 'ai-core',
    system: 'AI CORE',
    domain: 'Agents & LLM Orchestration',
    level: 90,
    items: ['LangChain', 'LangGraph', 'RAG', 'Multi-agent systems', 'Ollama/Groq'],
    detail:
      'CSOD Harness (−56% token burn), an 8-node LangGraph document-ETL fabric, and a published agentic financial advisor.',
  },
  {
    id: 'nav',
    system: 'NAV COMPUTER',
    domain: 'ML & Data Science',
    level: 88,
    items: ['Python', 'Scikit-learn', 'TensorFlow', 'Pandas/NumPy', 'Statsmodels'],
    detail:
      'Customer segmentation + CLV at Samsung R&D; physiological time-series classification at Titan Smart Labs.',
  },
  {
    id: 'comms',
    system: 'COMMS ARRAY',
    domain: 'Backend & APIs',
    level: 88,
    items: ['FastAPI', 'Node.js', '.NET', 'Flask', 'REST'],
    detail:
      'Microservice APIs at Deloitte (90%+ test coverage), job-lifecycle REST APIs on the CSX Scheduler.',
  },
  {
    id: 'structural',
    system: 'STRUCTURAL',
    domain: 'Systems Languages',
    level: 82,
    items: ['Go', 'Rust', 'C/C++', 'Java'],
    detail:
      'Rust parallel PDF renderer in 22+ production regions; Go worker pools pushing 100 sends/sec in MailForge.',
  },
  {
    id: 'power',
    system: 'POWER PLANT',
    domain: 'Data & Infra',
    level: 85,
    items: ['PostgreSQL', 'Redis', 'Docker', 'AWS', 'Cloudflare'],
    detail:
      'Queues, caches and containers under everything above. Deployed campus-scale apps on Cloudflare + AWS.',
  },
  {
    id: 'sensors',
    system: 'SENSOR SUITE',
    domain: 'Vision & Edge',
    level: 80,
    items: ['YOLO', 'SegFormer', 'SAM', 'ROS', 'Jetson/RPi'],
    detail:
      'Autonomous drone perception stack — vision + SLAM on edge hardware — that took first at ISDC 2024.',
  },
  {
    id: 'life',
    system: 'LIFE SUPPORT',
    domain: 'Tooling & Process',
    level: 84,
    items: ['Git', 'Linux', 'Jenkins', 'GitHub Actions', 'PyTest'],
    detail: 'CI, tests, and the boring reliability work that keeps the rest breathing.',
  },
];
