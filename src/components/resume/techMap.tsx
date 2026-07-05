'use client';

import type { IconType } from 'react-icons';
import {
  SiPython,
  SiTypescript,
  SiJavascript,
  SiGo,
  SiRust,
  SiC,
  SiCplusplus,
  SiR,
  SiReact,
  SiNextdotjs,
  SiTailwindcss,
  SiThreedotjs,
  SiHtml5,
  SiCss,
  SiFramer,
  SiFastapi,
  SiNodedotjs,
  SiDotnet,
  SiFlask,
  SiExpress,
  SiDjango,
  SiPrisma,
  SiPostman,
  SiNginx,
  SiTensorflow,
  SiPytorch,
  SiScikitlearn,
  SiKeras,
  SiOpencv,
  SiPandas,
  SiNumpy,
  SiLangchain,
  SiOllama,
  SiStreamlit,
  SiPostgresql,
  SiMongodb,
  SiMysql,
  SiRedis,
  SiDocker,
  SiCloudflare,
  SiLinux,
  SiGit,
  SiGithubactions,
  SiJenkins,
  SiPytest,
  SiRos,
  SiArduino,
  SiFigma,
} from 'react-icons/si';
import { FaAws, FaJava } from 'react-icons/fa6';

export interface TechMeta {
  Icon: IconType;
  /** brand color, shown on hover / accent */
  color: string;
}

/** tech name → logo + brand color (simple-icons via react-icons) */
export const TECH: Record<string, TechMeta> = {
  Python: { Icon: SiPython, color: '#3776AB' },
  TypeScript: { Icon: SiTypescript, color: '#3178C6' },
  JavaScript: { Icon: SiJavascript, color: '#F7DF1E' },
  Go: { Icon: SiGo, color: '#00ADD8' },
  Rust: { Icon: SiRust, color: '#F74C00' },
  C: { Icon: SiC, color: '#A8B9CC' },
  'C++': { Icon: SiCplusplus, color: '#00599C' },
  Java: { Icon: FaJava, color: '#E76F00' },
  R: { Icon: SiR, color: '#276DC3' },

  React: { Icon: SiReact, color: '#61DAFB' },
  'Next.js': { Icon: SiNextdotjs, color: '#EAF6FA' },
  'Tailwind CSS': { Icon: SiTailwindcss, color: '#06B6D4' },
  Tailwind: { Icon: SiTailwindcss, color: '#06B6D4' },
  'Three.js': { Icon: SiThreedotjs, color: '#EAF6FA' },
  HTML: { Icon: SiHtml5, color: '#E34F26' },
  CSS: { Icon: SiCss, color: '#663399' },
  Framer: { Icon: SiFramer, color: '#0055FF' },

  FastAPI: { Icon: SiFastapi, color: '#009688' },
  'Node.js': { Icon: SiNodedotjs, color: '#5FA04E' },
  '.NET': { Icon: SiDotnet, color: '#512BD4' },
  Flask: { Icon: SiFlask, color: '#EAF6FA' },
  Express: { Icon: SiExpress, color: '#EAF6FA' },
  Django: { Icon: SiDjango, color: '#092E20' },
  Prisma: { Icon: SiPrisma, color: '#2D3748' },
  Postman: { Icon: SiPostman, color: '#FF6C37' },
  NGINX: { Icon: SiNginx, color: '#009639' },

  TensorFlow: { Icon: SiTensorflow, color: '#FF6F00' },
  PyTorch: { Icon: SiPytorch, color: '#EE4C2C' },
  'Scikit-learn': { Icon: SiScikitlearn, color: '#F7931E' },
  Keras: { Icon: SiKeras, color: '#D00000' },
  OpenCV: { Icon: SiOpencv, color: '#5C3EE8' },
  Pandas: { Icon: SiPandas, color: '#8AA6B4' },
  NumPy: { Icon: SiNumpy, color: '#4DABCF' },
  LangChain: { Icon: SiLangchain, color: '#1C3C3C' },
  Ollama: { Icon: SiOllama, color: '#EAF6FA' },
  Streamlit: { Icon: SiStreamlit, color: '#FF4B4B' },

  PostgreSQL: { Icon: SiPostgresql, color: '#4169E1' },
  MongoDB: { Icon: SiMongodb, color: '#47A248' },
  MySQL: { Icon: SiMysql, color: '#4479A1' },
  Redis: { Icon: SiRedis, color: '#FF4438' },
  Docker: { Icon: SiDocker, color: '#2496ED' },
  AWS: { Icon: FaAws, color: '#FF9900' },
  Cloudflare: { Icon: SiCloudflare, color: '#F38020' },
  Linux: { Icon: SiLinux, color: '#FCC624' },

  Git: { Icon: SiGit, color: '#F05032' },
  'GitHub Actions': { Icon: SiGithubactions, color: '#2088FF' },
  Jenkins: { Icon: SiJenkins, color: '#D24939' },
  PyTest: { Icon: SiPytest, color: '#0A9EDC' },
  ROS: { Icon: SiRos, color: '#22314E' },
  Arduino: { Icon: SiArduino, color: '#00878F' },
  Figma: { Icon: SiFigma, color: '#F24E1E' },
};

export interface SkillGroup {
  id: string;
  title: string;
  /** bento span on md+ (1 or 2 columns) */
  span: 1 | 2;
  items: string[];
}

/** the split skills grid for the résumé — every item resolves in TECH */
export const SKILL_GROUPS: SkillGroup[] = [
  {
    id: 'languages',
    title: 'Programming Languages',
    span: 2,
    items: ['Python', 'TypeScript', 'JavaScript', 'Go', 'Rust', 'C', 'C++', 'Java', 'R'],
  },
  {
    id: 'frontend',
    title: 'Frontend Development',
    span: 1,
    items: ['React', 'Next.js', 'Tailwind CSS', 'Three.js', 'HTML', 'CSS', 'Framer'],
  },
  {
    id: 'backend',
    title: 'Backend Development',
    span: 1,
    items: ['FastAPI', 'Node.js', '.NET', 'Flask', 'Express', 'Django', 'Prisma', 'NGINX', 'Postman'],
  },
  {
    id: 'aiml',
    title: 'AI & Machine Learning',
    span: 2,
    items: [
      'TensorFlow',
      'PyTorch',
      'Scikit-learn',
      'Keras',
      'OpenCV',
      'Pandas',
      'NumPy',
      'LangChain',
      'Ollama',
      'Streamlit',
    ],
  },
  {
    id: 'data-infra',
    title: 'Data & Infrastructure',
    span: 2,
    items: ['PostgreSQL', 'MongoDB', 'MySQL', 'Redis', 'Docker', 'AWS', 'Cloudflare', 'Linux'],
  },
  {
    id: 'tools',
    title: 'Tools & Edge',
    span: 1,
    items: ['Git', 'GitHub Actions', 'Jenkins', 'PyTest', 'ROS', 'Arduino', 'Figma'],
  },
];
