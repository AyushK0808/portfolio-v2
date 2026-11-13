import { ALL_LOCATIONS, LOCATIONS, LocationId } from '@/lib/theme';

/**
 * Deep links. Every location has an address (`/#projects`); the hub is the bare
 * address. Arriving somewhere pushes a history entry, so the browser's Back and
 * Forward buttons move between visited locations. Stops inside a location do not
 * create entries.
 *
 * This module only reads and writes the address bar. The popstate listener lives
 * in App, which owns the store.
 */

export function hashFor(location: LocationId): string {
  const h = LOCATIONS[location].hash;
  return h ? `#${h}` : '';
}

/** the location a hash names, or null for an empty / unknown hash */
export function locationFromHash(hash: string): LocationId | null {
  const h = hash.replace(/^#/, '').toLowerCase();
  if (!h) return null;
  return ALL_LOCATIONS.find((id) => LOCATIONS[id].hash === h) ?? null;
}

/** the location the address bar currently points at (hub when there is no hash) */
export function currentAddressLocation(): LocationId {
  if (typeof window === 'undefined') return 'HUB';
  return locationFromHash(window.location.hash) ?? 'HUB';
}

function urlFor(location: LocationId): string {
  return `${window.location.pathname}${window.location.search}${hashFor(location)}`;
}

/** record an arrival as a new history entry (no-op if the address already matches) */
export function pushLocation(location: LocationId) {
  if (typeof window === 'undefined') return;
  if (currentAddressLocation() === location) return;
  window.history.pushState({ location }, '', urlFor(location));
}

/** rewrite the current entry without adding one (first load, unknown hashes) */
export function replaceLocation(location: LocationId) {
  if (typeof window === 'undefined') return;
  window.history.replaceState({ location }, '', urlFor(location));
}
