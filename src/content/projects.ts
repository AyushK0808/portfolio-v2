// Debris field (Mission C) — 12 scannable artifacts. `mesh` picks one of the
// procedural artifact meshes; positions are assigned by the sector layout.

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
    id: 'harness',
    title: 'CSOD HARNESS',
    oneLiner:
      'Internal LLM engineering assistant — Roslyn source indexing, code–infrastructure knowledge graph, multi-model agent orchestration. Cut token consumption up to 56% in multi-repo incident debugging.',
    stack: ['.NET/Roslyn', 'LLM agents', 'Knowledge graph', 'Multi-model routing'],
    tags: ['AGENTS'],
    note: 'Built at Cornerstone OnDemand — internal.',
    mesh: 'reactor',
  },
  {
    id: 'pdf-pipeline',
    title: 'MASS PDF PIPELINE',
    oneLiner:
      'High-throughput PDF generation for HR onboarding forms: Python data/HTML transformation engine feeding a Rust-powered parallel renderer. Thousands of PDFs per batch across 22+ production regions.',
    stack: ['Rust', 'Python', 'HTML→PDF', 'AWS'],
    tags: ['SYSTEMS'],
    note: 'Built at Cornerstone OnDemand — internal.',
    mesh: 'derelict',
  },
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
  {
    id: 'messit',
    title: 'MESSIT',
    oneLiner:
      'Campus mess menus on the go — a utility thousands of VIT students actually open every day.',
    stack: ['Next.js', 'TypeScript'],
    tags: ['WEB'],
    repo: 'https://github.com/AyushK0808/messit-web',
    live: 'https://messit.vinnovateit.com',
    mesh: 'ring',
  },
  {
    id: 'vinhack',
    title: 'VINHACK 25',
    oneLiner:
      'Web platform for VinHack — the nationwide hackathon with 300+ participants that Ayush also organized.',
    stack: ['JavaScript', 'React'],
    tags: ['WEB'],
    repo: 'https://github.com/AyushK0808/VinHack25',
    live: 'https://vin-hack25.vercel.app',
    mesh: 'satellite',
  },
  {
    id: 'viit-web',
    title: 'VINNOVATEIT WEB 25',
    oneLiner:
      'The 2025 site for VIT’s premier innovation club — built and shipped under his watch as Technical Head.',
    stack: ['Next.js', 'TypeScript'],
    tags: ['WEB'],
    repo: 'https://github.com/AyushK0808/vinnovateit-website25',
    live: 'https://web25.vinnovateit.com',
    mesh: 'ring',
  },
  {
    id: 'kimag',
    title: 'KONNECTIONS IMAG',
    oneLiner:
      'Production website for Konnections IMAG, an integrated marketing & PR firm — client work, shipped.',
    stack: ['TypeScript', 'Next.js'],
    tags: ['WEB'],
    repo: 'https://github.com/AyushK0808/kimag-website',
    live: 'https://kimag-website.vercel.app',
    mesh: 'probe',
  },
  {
    id: 'sanskrit-nlp',
    title: 'SANSKRIT PHONOSEMANTICS',
    oneLiner:
      'NLP study of the correlation between phonetic structure and semantic meaning in Sanskrit Upaniṣads, using two embedding models.',
    stack: ['Python', 'Embeddings', 'NLP'],
    tags: ['RESEARCH'],
    repo: 'https://github.com/AyushK0808/nlp-seminar',
    mesh: 'shard',
  },
  {
    id: 'quillsync',
    title: 'QUILLSYNC',
    oneLiner:
      'Self-hostable notes & research assistant — Llama 3.2 with RAG for structuring notes, SearXNG meta-search for sources, collaborative workspaces. No third-party dependencies, your data stays yours.',
    stack: ['Python', 'Llama 3.2', 'RAG', 'SearXNG', 'Docker'],
    tags: ['AGENTS', 'SYSTEMS'],
    repo: 'https://github.com/AyushK0808/QuillSync',
    mesh: 'reactor',
  },
  {
    id: 'vitmun',
    title: 'VITMUN 2025 WEBSITE',
    oneLiner:
      'Conference platform for VIT Model United Nations serving 1,000+ users — event details, delegate registration, real-time updates. Containerized with Docker and deployed on a VM.',
    stack: ['Next.js', 'Docker'],
    tags: ['WEB'],
    live: 'https://vitmun-25.vercel.app',
    mesh: 'relay',
  },
  {
    id: 'component-predictor',
    title: 'COMPONENT SERVICE PREDICTOR',
    oneLiner:
      'LSTM model (82% accuracy) predicting equipment failures for proactive maintenance — React interface, automated service reports and reminders, plus an issue-reporting chatbot. Improved resource utilization by 75%.',
    stack: ['Python', 'LSTM', 'React'],
    tags: ['RESEARCH', 'WEB'],
    repo: 'https://github.com/AyushK0808/Component_Sevice_Predictor',
    live: 'https://component-sevice-predictor.vercel.app',
    mesh: 'probe',
  },
  {
    id: 'maafia',
    title: 'MAA-FIA',
    oneLiner:
      'App helping women return to work after a career break — generates personalized task plans with Google’s Gemini API. Built the Next.js frontend and the Gemini integration.',
    stack: ['Next.js', 'Gemini API'],
    tags: ['WEB', 'AGENTS'],
    repo: 'https://github.com/AyushK0808/MAA-FIA',
    mesh: 'satellite',
  },
  {
    id: 'ai-chatbot',
    title: 'AI CHARACTER CHATBOT',
    oneLiner:
      'Chat with your favorite characters as if they were real — GPT-generated conversations, Next.js frontend, MongoDB persistence.',
    stack: ['Next.js', 'MongoDB', 'GPT'],
    tags: ['WEB', 'AGENTS'],
    mesh: 'derelict',
  },
  {
    id: 'tunecraft',
    title: 'TUNECRAFT',
    oneLiner:
      'LSTM lyric generator that writes in the style of any artist — dataset assembled from the Genius API, trained to mimic phrasing and vocabulary.',
    stack: ['Python', 'LSTM', 'Genius API'],
    tags: ['RESEARCH'],
    mesh: 'shard',
  },
  {
    id: 'saps',
    title: 'SCHEDULE ALLOCATION & PLANNING SYSTEM',
    oneLiner:
      'Python app managing warden shift scheduling for the VIT Ladies Hostel — Tkinter frontend plus a monthly mailer delivering schedules to the Chief Warden.',
    stack: ['Python', 'Tkinter'],
    tags: ['SYSTEMS'],
    mesh: 'capsule',
  },
];

export const PROJECT_TAGS: ProjectTag[] = ['AGENTS', 'WEB', 'SYSTEMS', 'RESEARCH'];
