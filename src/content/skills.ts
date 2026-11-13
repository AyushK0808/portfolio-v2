// Skills stop (Anvil Yards) — five groups, one dock each. No self-rated
// percentages: each group shows its technologies and one line of proof.

export interface SkillGroup {
  id: string;
  /** ship-system flavour name shown on the in-world marker */
  system: string;
  /** the plain-language name of the discipline */
  domain: string;
  items: string[];
  /** where this was actually used */
  proof: string;
}

export const SKILLS: SkillGroup[] = [
  {
    id: 'ai',
    system: 'AI CORE',
    domain: 'AI & Agents',
    items: [
      'LangChain',
      'LangGraph',
      'RAG',
      'Multi-agent systems',
      'Scikit-learn',
      'TensorFlow',
      'YOLO / SAM',
    ],
    proof:
      'CSOD Harness (−56% token burn), an 8-node LangGraph document-ETL pipeline, customer segmentation at Samsung R&D, and the drone perception stack that took first at ISDC 2024.',
  },
  {
    id: 'frontend',
    system: 'PROPULSION',
    domain: 'Frontend',
    items: ['TypeScript', 'React', 'Next.js', 'Tailwind', 'Three.js'],
    proof:
      'Production dashboards at CSOD, and 15+ full-stack builds at VinnovateIT serving 30k+ users.',
  },
  {
    id: 'backend',
    system: 'COMMS ARRAY',
    domain: 'Backend & APIs',
    items: ['FastAPI', 'Node.js', '.NET', 'Flask', 'REST'],
    proof:
      'Microservice APIs at Deloitte (90%+ test coverage), and job-lifecycle REST APIs on the CSX Scheduler.',
  },
  {
    id: 'systems',
    system: 'STRUCTURAL',
    domain: 'Systems',
    items: ['Go', 'Rust', 'C/C++', 'Java'],
    proof:
      'A Rust parallel PDF renderer live in 22+ production regions; Go worker pools pushing 100 sends/sec in MailForge.',
  },
  {
    id: 'infra',
    system: 'POWER PLANT',
    domain: 'Infra & Tooling',
    items: [
      'PostgreSQL',
      'Redis',
      'Docker',
      'AWS',
      'Cloudflare',
      'Linux',
      'GitHub Actions',
      'PyTest',
    ],
    proof:
      'Queues, caches, containers and CI under everything above. Campus-scale apps deployed on Cloudflare + AWS.',
  },
];
