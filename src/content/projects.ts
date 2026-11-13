// Projects stop (The Drift) — five solo repos, each with a public repository.
// Everything else lives behind the GitHub link. `mesh` picks one of the
// procedural artifact meshes; positions are assigned by the flight plan.

export type ProjectTag = 'AGENTS' | 'WEB' | 'SYSTEMS' | 'RESEARCH';

export interface Project {
  id: string;
  title: string;
  oneLiner: string;
  stack: string[];
  tags: ProjectTag[];
  repo?: string;
  live?: string;
  note?: string;
  mesh:
    | 'satellite'
    | 'derelict'
    | 'shard'
    | 'probe'
    | 'ring'
    | 'reactor'
    | 'relay'
    | 'capsule';
}

export const PROJECTS: Project[] = [
  {
    id: 'form-etl',
    title: 'MULTI-AGENT FORM ETL',
    oneLiner:
      'Layout-aware document extraction: LayoutLMv3 + Donut in parallel, fused by a confidence-weighted reflexive policy. LangGraph 8-node pipeline with LoRA-adapter routing and Groq schema synthesis.',
    stack: ['Python', 'LayoutLMv3', 'Donut', 'LangGraph', 'LoRA/PEFT', 'Groq'],
    tags: ['AGENTS', 'RESEARCH'],
    repo: 'https://github.com/AyushK0808/multiagent-form-schema-etl',
    mesh: 'satellite',
  },
  {
    id: 'mailforge',
    title: 'MAILFORGE',
    oneLiner:
      'Self-hosted mass-email platform: Go API, Redis-queued worker pool (20 goroutines, 100 sends/sec, retry-with-backoff), JWT multi-tenancy, Next.js dashboard. Fully containerized with CI.',
    stack: ['Go', 'Next.js', 'PostgreSQL', 'Redis', 'Docker', 'NGINX'],
    tags: ['SYSTEMS', 'WEB'],
    repo: 'https://github.com/AyushK0808/mailforge',
    mesh: 'relay',
  },
  {
    id: 'fin-advisor',
    title: 'FINANCIAL ADVISOR',
    oneLiner:
      'Sentiment-augmented AI investment analysis — market indicators + investor profiling + news sentiment → explainable buy/hold/sell. Local LLM (LLaMA 3.2) with RAG. Accepted at ICACKE 2026.',
    stack: ['Python', 'LangChain', 'Ollama', 'Streamlit', 'yFinance'],
    tags: ['RESEARCH', 'AGENTS'],
    repo: 'https://github.com/AyushK0808/financial-advisor',
    mesh: 'probe',
  },
  {
    id: 'chip8',
    title: 'CHIP-8 EMULATOR',
    oneLiner:
      'A CHIP-8 virtual machine written in Rust — opcode interpreter, display, timers and input, built to learn emulation from the metal up.',
    stack: ['Rust'],
    tags: ['SYSTEMS'],
    repo: 'https://github.com/AyushK0808/chip8-emulator',
    mesh: 'capsule',
  },
  {
    id: 'rust-gpt-cli',
    title: 'RUST GPT CLI',
    oneLiner:
      'Natural language → SQL at the terminal. A Rust CLI that turns plain-English prompts into executable queries.',
    stack: ['Rust', 'LLM API'],
    tags: ['SYSTEMS', 'AGENTS'],
    repo: 'https://github.com/AyushK0808/rust-gpt-cli',
    mesh: 'shard',
  },
];

/** where the rest of the work lives */
export const GITHUB_URL = 'https://github.com/AyushK0808';

export const PROJECT_TAGS: ProjectTag[] = ['AGENTS', 'WEB', 'SYSTEMS', 'RESEARCH'];
