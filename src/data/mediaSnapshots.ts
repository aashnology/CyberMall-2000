/**
 * Floor 6 "Theatre and OTT": structured SNAPSHOT fixtures.
 *
 * Live ticketing / streaming APIs arrive in a later milestone. Until then this
 * file is the single source for Floor 6, and the UI must label it as a snapshot.
 * Every record carries its own `basis` so nothing here can masquerade as live data.
 *
 * What is and isn't verified (captured 2026-10-23):
 *  - OTT titles: taken from Ormax Media's "India OTT Watchlist, Jan–Jun 2026" (H1 viewership,
 *    NOT this week's chart). Platform assignments follow that report.
 *  - Theatre titles: come from October 2026 release calendars that disagree with each other;
 *    treat as 'unverified-schedule'.
 *  - Showtimes: ILLUSTRATIVE. Invented slots, not scraped from any ticketing site.
 *  - Theatre venues: chain + locality + pincode written from general knowledge; not checked
 *    against the chains' own listings.
 *  - OTT deep links: platform home pages only. Title-level deep links need the live API.
 */

import { haversineKm, type PincodeDirectory } from './indiaPost';
import type { Pincode } from './types';

export interface SnapshotMeta {
  readonly capturedAt: string; // ISO date
  readonly basis: string;
  readonly isFixture: true;
}

/* ───────────────────────── Theatres ───────────────────────── */

export type Format = '2D' | 'IMAX' | '4DX' | 'Dolby Atmos';

export interface Film {
  readonly id: string;
  readonly title: string;
  readonly languages: readonly string[];
  readonly titleBasis: 'unverified-schedule';
}

export interface Screening {
  readonly filmId: string;
  readonly format: Format;
  /** 24-hour "HH:MM", ascending. Illustrative. */
  readonly times: readonly string[];
}

export interface Theatre {
  readonly id: string;
  readonly chain: string;
  readonly locality: string;
  readonly city: 'Mumbai' | 'Delhi' | 'Bengaluru';
  readonly pincode: string;
  readonly screenings: readonly Screening[];
}

export const THEATRE_META: SnapshotMeta = {
  capturedAt: '2026-10-23',
  basis: 'Titles from conflicting Oct-2026 release calendars; showtimes and venue details are illustrative.',
  isFixture: true,
};

export const FILMS: readonly Film[] = [
  { id: 'drishyam-3', title: 'Drishyam 3', languages: ['Hindi'], titleBasis: 'unverified-schedule' },
  { id: 'jailer-2', title: 'Jailer 2', languages: ['Tamil', 'Telugu', 'Hindi'], titleBasis: 'unverified-schedule' },
  { id: 'haiwaan', title: 'Haiwaan', languages: ['Hindi'], titleBasis: 'unverified-schedule' },
];

const T = (filmId: string, format: Format, ...times: string[]): Screening => ({ filmId, format, times });

export const THEATRES: readonly Theatre[] = [
  { id: 'pvr-icon-andheri', chain: 'PVR', locality: 'Andheri West', city: 'Mumbai', pincode: '400053',
    screenings: [T('drishyam-3', '2D', '10:30', '13:45', '19:00', '22:15'), T('jailer-2', 'Dolby Atmos', '11:15', '15:00', '20:30')] },
  { id: 'pvr-juhu', chain: 'PVR', locality: 'Juhu', city: 'Mumbai', pincode: '400049',
    screenings: [T('drishyam-3', '2D', '12:00', '16:30', '21:00'), T('haiwaan', '2D', '10:00', '14:15', '18:45')] },
  { id: 'pvr-palladium-lower-parel', chain: 'PVR', locality: 'Lower Parel', city: 'Mumbai', pincode: '400013',
    screenings: [T('drishyam-3', 'IMAX', '11:00', '15:15', '19:30'), T('jailer-2', '2D', '12:30', '17:00', '21:45')] },
  { id: 'inox-nariman-point', chain: 'INOX', locality: 'Nariman Point', city: 'Mumbai', pincode: '400021',
    screenings: [T('haiwaan', '2D', '10:45', '14:00', '19:15'), T('drishyam-3', '2D', '13:00', '17:30', '22:00')] },
  { id: 'pvr-plaza-cp', chain: 'PVR', locality: 'Connaught Place', city: 'Delhi', pincode: '110001',
    screenings: [T('drishyam-3', '2D', '10:15', '13:30', '18:00', '21:30'), T('haiwaan', '2D', '11:45', '16:15', '20:45')] },
  { id: 'pvr-citywalk-saket', chain: 'PVR', locality: 'Saket', city: 'Delhi', pincode: '110017',
    screenings: [T('jailer-2', '4DX', '12:15', '16:45', '21:15'), T('drishyam-3', 'Dolby Atmos', '10:00', '14:30', '19:45')] },
  { id: 'inox-garuda-mg-road', chain: 'INOX', locality: 'MG Road', city: 'Bengaluru', pincode: '560025',
    screenings: [T('jailer-2', '2D', '10:30', '14:00', '18:30', '22:00'), T('drishyam-3', '2D', '12:45', '17:15', '21:30')] },
  { id: 'pvr-vr-whitefield', chain: 'PVR', locality: 'Whitefield', city: 'Bengaluru', pincode: '560066',
    screenings: [T('jailer-2', 'IMAX', '11:30', '15:45', '20:00'), T('haiwaan', '2D', '10:00', '13:15', '18:15')] },
  { id: 'pvr-marketcity-mahadevapura', chain: 'PVR', locality: 'Mahadevapura', city: 'Bengaluru', pincode: '560048',
    screenings: [T('drishyam-3', '2D', '11:00', '14:30', '19:00', '22:30'), T('jailer-2', 'Dolby Atmos', '12:00', '16:30', '21:00')] },
];

/* ───────────────────────── Nearest theatres ───────────────────────── */

export type ProximityBasis = 'distance-km' | 'pin-similarity';

export interface RankedTheatre {
  readonly theatre: Theatre;
  /** Kilometres when basis is 'distance-km'; otherwise a unit-less dissimilarity (lower = closer). */
  readonly score: number;
}

export interface NearestResult {
  readonly basis: ProximityBasis;
  readonly ranked: readonly RankedTheatre[];
}

function commonPrefixLength(a: string, b: string): number {
  let i = 0;
  while (i < a.length && i < b.length && a[i] === b[i]) i += 1;
  return i;
}

/** Lower = more similar. Prefix match dominates; numeric gap breaks ties. */
function pinDissimilarity(a: string, b: string): number {
  return (6 - commonPrefixLength(a, b)) * 1_000_000 + Math.abs(Number(a) - Number(b));
}

/**
 * Theatres nearest to `pincode`.
 *  - With an India Post directory that has coordinates for the visitor's PIN and EVERY theatre's
 *    PIN, ranking is by true great-circle distance.
 *  - Otherwise every theatre is ranked by PIN similarity (shared prefix, then numeric gap).
 *    That is a heuristic, not geography. `basis` tells the UI which one it is getting so it can
 *    show "~4.2 km" only when that is real.
 * A single basis is used for all candidates so scores are never mixed across units.
 */
export function nearestTheatres(
  pincode: Pincode,
  theatres: readonly Theatre[] = THEATRES,
  directory: PincodeDirectory | null = null,
  limit = 5,
): NearestResult {
  const here = directory?.centroid(pincode) ?? null;
  const canUseDistance =
    directory !== null && here !== null && theatres.every((t) => directory.centroid(t.pincode) !== null);

  const ranked: RankedTheatre[] = theatres.map((theatre) => {
    if (canUseDistance && directory !== null && here !== null) {
      const c = directory.centroid(theatre.pincode);
      return { theatre, score: c === null ? Number.POSITIVE_INFINITY : haversineKm(here, c) };
    }
    return { theatre, score: pinDissimilarity(pincode, theatre.pincode) };
  });
  ranked.sort((a, b) => a.score - b.score || a.theatre.id.localeCompare(b.theatre.id));
  return { basis: canUseDistance ? 'distance-km' : 'pin-similarity', ranked: ranked.slice(0, Math.max(0, limit)) };
}

/* ───────────────────────── OTT ───────────────────────── */

export type OttPlatformId = 'netflix' | 'prime-video' | 'jiohotstar' | 'amazon-mx-player';

export interface OttTitle {
  readonly id: string;
  readonly title: string;
  readonly kind: 'series' | 'film';
}

export interface OttPlatform {
  readonly id: OttPlatformId;
  readonly name: string;
  /** Platform home page. Title-level deep links need the live API milestone. */
  readonly deepLink: string;
  readonly deepLinkKind: 'platform-home';
  readonly hotAndTrending: readonly OttTitle[];
}

export const OTT_META: SnapshotMeta = {
  capturedAt: '2026-10-23',
  basis: 'Ormax Media, India OTT Watchlist Jan–Jun 2026 (half-year most-watched, not a weekly chart).',
  isFixture: true,
};

export const OTT_PLATFORMS: readonly OttPlatform[] = [
  { id: 'netflix', name: 'Netflix', deepLink: 'https://www.netflix.com/in/', deepLinkKind: 'platform-home',
    hotAndTrending: [
      { id: 'taskaree', title: "Taskaree: The Smuggler's Web", kind: 'series' },
      { id: 'haq', title: 'Haq', kind: 'film' },
      { id: 'de-de-pyaar-de-2', title: 'De De Pyaar De 2', kind: 'film' },
    ] },
  { id: 'prime-video', name: 'Amazon Prime Video', deepLink: 'https://www.primevideo.com/', deepLinkKind: 'platform-home',
    hotAndTrending: [
      { id: 'matka-king', title: 'Matka King', kind: 'series' },
      { id: 'gram-chikitsalay-s2', title: 'Gram Chikitsalay S2', kind: 'series' },
      { id: 'aspirants-s3', title: 'Aspirants S3', kind: 'series' },
    ] },
  { id: 'jiohotstar', name: 'JioHotstar', deepLink: 'https://www.hotstar.com/in', deepLinkKind: 'platform-home',
    hotAndTrending: [
      { id: 'chiraiya', title: 'Chiraiya', kind: 'series' },
      { id: 'inspector-avinash-s2', title: 'Inspector Avinash S2', kind: 'series' },
      { id: 'dhurandhar-the-revenge', title: 'Dhurandhar: The Revenge', kind: 'film' },
    ] },
  { id: 'amazon-mx-player', name: 'Amazon MX Player', deepLink: 'https://www.mxplayer.in/', deepLinkKind: 'platform-home',
    hotAndTrending: [
      { id: 'made-in-india-a-titan-story', title: 'Made In India: A Titan Story', kind: 'series' },
      { id: 'ab-hoga-hisaab', title: 'Ab Hoga Hisaab', kind: 'series' },
    ] },
];
