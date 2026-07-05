export const SITE = {
  name: 'Ayush Kumar',
  title: 'PILOT: AYUSH KUMAR',
  tagline: 'Software engineer · agents, systems & the web',
  description:
    'First-person spaceship portfolio of Ayush Kumar — Junior Engineer at Cornerstone OnDemand, VIT Vellore CSE ’26. Agents, distributed systems, web, and autonomous drones.',
  url: 'https://ayushk08.com',
  email: 'theofficialayush.kumar@gmail.com',
  phone: '+91-7032853030',
  resumePdf: '/ayush_kumar_resume.pdf',
} as const;

export interface Frequency {
  id: string;
  label: string;
  /** fictional comm frequency, pure flavor */
  freq: string;
  value: string;
  href: string;
}

export const FREQUENCIES: Frequency[] = [
  {
    id: 'github',
    label: 'GITHUB',
    freq: '121.500 MHz',
    value: 'AyushK0808',
    href: 'https://github.com/AyushK0808',
  },
  {
    id: 'linkedin',
    label: 'LINKEDIN',
    freq: '243.000 MHz',
    value: 'ayushk0808',
    href: 'https://www.linkedin.com/in/ayushk0808',
  },
  {
    id: 'email',
    label: 'EMAIL',
    freq: '406.025 MHz',
    value: 'theofficialayush.kumar@gmail.com',
    href: 'mailto:theofficialayush.kumar@gmail.com',
  },
  {
    id: 'site',
    label: 'BEACON',
    freq: '156.800 MHz',
    value: 'ayushk08.com',
    href: 'https://ayushk08.com',
  },
];
