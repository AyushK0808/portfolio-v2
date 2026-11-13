// Pilot record — the About stop, and the résumé's About section.

export const DOSSIER = {
  callsign: 'AYUSH KUMAR',
  rank: 'JUNIOR ENGINEER',
  posting: 'CORNERSTONE ONDEMAND · MUMBAI',
  origin: 'VIT VELLORE · B.TECH CSE · CLASS OF 2026',
  gpa: '9.35 / 10.0',
  status: 'ACTIVE DUTY',
  /** portrait for the About card (a silhouette is shown if the file is missing) */
  photo: '/me.jpg',
  /** where the face is in that photo (% from left / top) and how far to zoom in,
   *  so a full-length shot still frames as head and shoulders */
  photoFocus: { x: 46, y: 27, zoom: 3 },
  /** the About card on the route — kept to two sentences */
  short: [
    'Engineer who likes the whole stack — from LLM agent orchestration and ML pipelines down to Rust services and the React dashboards that fly them.',
    'Currently building enterprise job orchestration and an LLM-powered engineering assistant at Cornerstone OnDemand.',
  ],
  /** the longer version, used by the text résumé */
  bio: [
    'Engineer who likes the whole stack — from LLM agent orchestration and ML pipelines down to Rust services and the React dashboards that fly them.',
    'Currently building enterprise job orchestration and an LLM-powered engineering assistant at Cornerstone OnDemand. Previously shipped AI backends at Deloitte, customer-segmentation ML at Samsung R&D, and wearable signal pipelines at Titan Smart Labs.',
    'Off-duty: led the software stack that won the International Space Drone Challenge 2024, mentored 200+ builders as Technical Head of VinnovateIT, and published research on agentic document ETL.',
  ],
  traits: [
    'AGENT ORCHESTRATION',
    'DISTRIBUTED SYSTEMS',
    'FULL-STACK WEB',
    'AUTONOMOUS DRONES',
  ],
} as const;

/**
 * The two extra About stops. DRAFT: every line below is drawn from the résumé
 * PDF (public/ayush_kumar_resume.pdf) and nothing else — reword freely, and
 * replace the interests with personal ones if you want them to go beyond work.
 */
export const HOW_I_WORK = {
  title: 'HOW I WORK',
  subtitle: 'ML SYSTEMS MEET BACKEND INFRASTRUCTURE',
  bullets: [
    'End to end: API, workers, dashboard, containers and CI. MailForge and the Cornerstone PDF pipeline both shipped that way.',
    'Measured: 90%+ test coverage at Deloitte, a 56% token cut on the engineering assistant, leave-one-subject-out validation at Titan.',
    'The right tool for the job: .NET, Go, Rust and Python, each where it fits.',
    'Built for production: 22+ regions at Cornerstone, 30k+ campus users at VinnovateIT.',
  ],
  chips: ['OWN THE WHOLE PATH', 'MEASURE IT', 'SHIP TO PRODUCTION'],
} as const;

export const INTERESTS = {
  title: 'INTERESTS',
  subtitle: 'THE THREADS THAT KEEP COMING BACK',
  bullets: [
    'LLM agents: CSOD Harness at work, and a LangGraph 8-node document pipeline as research.',
    'Autonomous drones: led the vision and SLAM stack that took first place at ISDC 2024.',
    'Local, privacy-preserving LLMs: the financial advisor accepted at ICACKE 2026 runs its model on-device.',
    'Hackathons and teaching: organised VinHack (300+ participants) and mentored 200+ members.',
  ],
  chips: [
    'LLM AGENTS',
    'DOCUMENT INTELLIGENCE',
    'AUTONOMOUS DRONES',
    'RUST & GO SYSTEMS',
    'LOCAL LLMS',
    'HACKATHONS',
  ],
} as const;
