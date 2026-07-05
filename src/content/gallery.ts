// Observation Deck (Mission D). Drop real photos into /public/gallery/ with
// the filenames below and they will be textured onto the frames; any missing
// file falls back to a procedural "awaiting transmission" hologram.

export interface GalleryFrame {
  id: string;
  src: string;
  caption: string;
  sub: string;
}

export const GALLERY: GalleryFrame[] = [
  { id: 'g1', src: '/gallery/01.jpg', caption: 'ISDC 2024 — FIRST PLACE', sub: 'Team Ardra, International Space Drone Challenge' },
  { id: 'g2', src: '/gallery/02.jpg', caption: 'FLIGHT TEST', sub: 'Autonomous drone trials, VIT Vellore' },
  { id: 'g3', src: '/gallery/03.jpg', caption: 'VINHACK CONTROL ROOM', sub: '300+ hackers, one long night' },
  { id: 'g4', src: '/gallery/04.jpg', caption: 'VINNOVATEIT CREW', sub: '200+ members mentored' },
  { id: 'g5', src: '/gallery/05.jpg', caption: 'CAMPUS ORBIT', sub: 'VIT Vellore, home station' },
  { id: 'g6', src: '/gallery/06.jpg', caption: 'HYDERABAD DEPLOYMENT', sub: 'Deloitte USI, summer 2025' },
  { id: 'g7', src: '/gallery/07.jpg', caption: 'MUMBAI SECTOR', sub: 'Cornerstone OnDemand, current posting' },
  { id: 'g8', src: '/gallery/08.jpg', caption: 'OFF DUTY', sub: 'Somewhere without Wi-Fi' },
];
