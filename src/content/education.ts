// Education history — used by the text résumé's Education timeline.

export interface EducationEntry {
  id: string;
  degree: string;
  institute: string;
  dates: string;
  grade: string;
  details: string;
}

export const EDUCATION: EducationEntry[] = [
  {
    id: 'vit',
    degree: 'B.Tech Computer Science & Engineering',
    institute: 'Vellore Institute of Technology, Vellore',
    dates: '2022 — 2026',
    grade: '9.35 / 10.0 GPA',
    details:
      'Focus on software development and machine learning. Research accepted at ICACKE 2026 — sentiment-augmented financial advisory system.',
  },
  {
    id: 'fiitjee',
    degree: 'Grade 12 — Science (PCM)',
    institute: 'FIITJEE Junior College, Narayanguda, Hyderabad',
    dates: '2020 — 2022',
    grade: '96.6%',
    details:
      'Specialized in the science stream with excellent performance in Physics, Chemistry, and Mathematics.',
  },
  {
    id: 'dps',
    degree: 'Grade 10',
    institute: 'Delhi Public School, Hyderabad',
    dates: '2008 — 2020',
    grade: '95.8%',
    details:
      'Top grades across all subjects, with a strong focus on Mathematics and Science.',
  },
];
