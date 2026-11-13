// Third-party work used on the site. The CC BY licence requires visible
// credit: title, author, source and licence for each model. Shown from the
// map's Credits entry. Keep this in step with what is actually in /public/3d.

export interface Credit {
  /** what it is used for here */
  usedAs: string;
  /** the work's own title, as published */
  title: string;
  author: string;
  license: string;
  licenseHref: string;
  href: string;
}

const CC_BY = {
  license: 'CC BY 4.0',
  licenseHref: 'https://creativecommons.org/licenses/by/4.0/',
};

export const CREDITS: Credit[] = [
  {
    usedAs: 'Hero ship',
    title: 'Northstar fighter ship',
    author: 'Mark Bai',
    ...CC_BY,
    href: 'https://sketchfab.com/3d-models/northstar-fighter-ship-a45170bb77fc4c568b7d94050ecbf54c',
  },
  {
    usedAs: 'Cockpit',
    title: 'Spacefighter Cockpit (Wasp Interdictor)',
    author: 'Comrade1280',
    ...CC_BY,
    href: 'https://sketchfab.com/3d-models/spacefighter-cockpit-wasp-interdictor-db4aa67fe1164ec088083d7dac2d273f',
  },
  {
    usedAs: 'Home station (About)',
    title: 'Star Wars: X7 Deep Space Manufacturing Facility',
    author: 'Daniel (DanielAndersson)',
    ...CC_BY,
    href: 'https://sketchfab.com/3d-models/star-wars-x7-deep-space-manufacturing-facility-0494761ce11a4c1ea1c9beb88a65269c',
  },
  {
    usedAs: 'Drifting props (Projects)',
    title: 'Star Wars: Package 1',
    author: 'Daniel (DanielAndersson)',
    ...CC_BY,
    href: 'https://sketchfab.com/3d-models/star-wars-package-1-969a19bf6ed54893875e8153f859ad0e',
  },
  {
    usedAs: 'Asteroids (Projects, game)',
    title: 'Asteroid low poly',
    author: 'pasquill',
    ...CC_BY,
    href: 'https://sketchfab.com/3d-models/asteroid-low-poly-9a43ef48a70647188576ccb5987b7e64',
  },
];
