// Renders each location's world to public/worlds/<id>.webp (768px) and
// <id>-sm.webp (192px) for the galaxy chart and the résumé page.
//
//   1. npm run dev
//   2. node scripts/capture-worlds.mjs            (all locations)
//      node scripts/capture-worlds.mjs experience (just one)
//
// Options (environment): BASE_URL (default http://localhost:3000),
// CHROME_PATH (a Chrome or Edge executable), PNG_DIR (also write PNG copies there).
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import puppeteer from 'puppeteer-core';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = join(ROOT, 'public', 'worlds');
const BASE = process.env.BASE_URL ?? 'http://localhost:3000';
const ALL = ['hub', 'about', 'skills', 'experience', 'projects', 'achievements', 'arena', 'comms'];
const ids = process.argv.slice(2).length ? process.argv.slice(2).map((s) => s.toLowerCase()) : ALL;

const chrome =
  process.env.CHROME_PATH ??
  [
    'C:/Program Files/Google/Chrome/Application/chrome.exe',
    'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    '/usr/bin/google-chrome',
    '/usr/bin/chromium',
  ].find((p) => existsSync(p));
if (!chrome) throw new Error('No Chrome or Edge found. Set CHROME_PATH.');

const save = (file, dataUrl) => writeFileSync(file, Buffer.from(dataUrl.split(',')[1], 'base64'));

mkdirSync(OUT, { recursive: true });
if (process.env.PNG_DIR) mkdirSync(process.env.PNG_DIR, { recursive: true });

const browser = await puppeteer.launch({
  executablePath: chrome,
  headless: true,
  args: ['--use-angle=d3d11', '--enable-gpu', '--ignore-gpu-blocklist', '--window-size=900,900'],
});
try {
  for (const id of ids) {
    const page = await browser.newPage();
    await page.setViewport({ width: 800, height: 800 });
    page.on('pageerror', (e) => console.error(`[${id}] page error:`, e.message));
    await page.goto(`${BASE}/dev/thumbs?id=${id}`, { waitUntil: 'networkidle2', timeout: 120000 });
    await page.waitForFunction('window.__ready === true && typeof window.__capture === "function"', {
      timeout: 120000,
    });
    const shot = await page.evaluate(() => window.__capture());
    save(join(OUT, `${id}.webp`), shot.lg);
    save(join(OUT, `${id}-sm.webp`), shot.sm);
    if (process.env.PNG_DIR) save(join(process.env.PNG_DIR, `${id}.png`), shot.png);
    console.log(`${id}: ${Math.round((shot.lg.length * 0.75) / 1024)}KB + ${Math.round((shot.sm.length * 0.75) / 1024)}KB`);
    await page.close();
  }
} finally {
  await browser.close();
}
