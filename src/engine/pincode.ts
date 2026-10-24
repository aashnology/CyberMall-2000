import type { Pincode, Store, FloorId } from '../data/types';
import { FLOOR_IDS } from '../data/types';

/* ───────────────────────── Parsing ───────────────────────── */

export type PincodeParseFailure =
  | 'empty'
  | 'non-numeric'
  | 'incomplete'
  | 'too-long'
  | 'invalid-leading-digit';

export type PincodeParse =
  | { readonly ok: true; readonly pincode: Pincode }
  | { readonly ok: false; readonly reason: PincodeParseFailure };

/** Indian PINs are six digits and never start with 0. Whitespace is ignored ("400 058"). */
export function parsePincode(raw: string): PincodeParse {
  const compact = raw.replace(/\s+/g, '');
  if (compact === '') return { ok: false, reason: 'empty' };
  if (/\D/.test(compact)) return { ok: false, reason: 'non-numeric' };
  if (compact.length < 6) return { ok: false, reason: 'incomplete' };
  if (compact.length > 6) return { ok: false, reason: 'too-long' };
  if (compact.startsWith('0')) return { ok: false, reason: 'invalid-leading-digit' };
  return { ok: true, pincode: compact as Pincode };
}

/* ───────────────────────── Serviceability ───────────────────────── */

export type DeliveryStatus = 'delivers' | 'not-deliverable' | 'unknown';

const serviceableIndex = new WeakMap<Store, ReadonlySet<string>>();

function serviceableSet(store: Store): ReadonlySet<string> {
  let set = serviceableIndex.get(store);
  if (set === undefined) {
    set = new Set(store.serviceablePincodes);
    serviceableIndex.set(store, set);
  }
  return set;
}

/** `null` pincode means the visitor has not entered one yet: status is 'unknown', never a guess. */
export function deliveryStatus(store: Store, pincode: Pincode | null): DeliveryStatus {
  if (pincode === null) return 'unknown';
  return serviceableSet(store).has(pincode) ? 'delivers' : 'not-deliverable';
}

export function ribbonText(pincode: Pincode): string {
  return `DOES NOT DELIVER TO ${pincode}`;
}

/* ───────────────────────── Directory ───────────────────────── */

export interface DirectoryEntry {
  readonly store: Store;
  readonly status: DeliveryStatus;
  /** Editorial ribbon copy; non-null only when status is 'not-deliverable'. */
  readonly ribbon: string | null;
}

export interface DirectoryOptions {
  readonly pincode: Pincode | null;
  /** "Only stores that deliver to me". Has no effect until a pincode is set. */
  readonly onlyDeliverable: boolean;
}

export interface DirectoryTotals {
  readonly all: number;
  readonly delivering: number;
  readonly notDelivering: number;
  readonly unknown: number;
  /** Stores removed from view by `onlyDeliverable`. */
  readonly hidden: number;
}

export interface DirectoryResult {
  readonly byFloor: Readonly<Record<FloorId, readonly DirectoryEntry[]>>;
  readonly totals: DirectoryTotals;
}

/**
 * Recompute the whole directory for a pincode.
 *
 * Guarantees:
 *  - Never truncates: every store appears unless `onlyDeliverable` hides it.
 *  - Stable order: entries keep catalog order so storefront positions on the
 *    concourse do not shuffle when the pincode changes.
 */
export function buildDirectory(stores: readonly Store[], options: DirectoryOptions): DirectoryResult {
  const { pincode, onlyDeliverable } = options;
  const byFloor = Object.fromEntries(FLOOR_IDS.map((id) => [id, [] as DirectoryEntry[]])) as Record<
    FloorId,
    DirectoryEntry[]
  >;

  let delivering = 0;
  let notDelivering = 0;
  let unknown = 0;
  let hidden = 0;

  for (const store of stores) {
    const status = deliveryStatus(store, pincode);
    if (status === 'delivers') delivering += 1;
    else if (status === 'not-deliverable') notDelivering += 1;
    else unknown += 1;

    if (onlyDeliverable && status === 'not-deliverable') {
      hidden += 1;
      continue;
    }
    byFloor[store.floorId].push({
      store,
      status,
      ribbon: status === 'not-deliverable' && pincode !== null ? ribbonText(pincode) : null,
    });
  }

  return { byFloor, totals: { all: stores.length, delivering, notDelivering, unknown, hidden } };
}

/* ───────────────────────── Catalog validation ───────────────────────── */

export interface CatalogIssue {
  readonly storeId: string;
  readonly message: string;
}

/** Run at startup/in CI. Returns every problem instead of stopping at the first. */
export function validateCatalog(stores: readonly Store[]): CatalogIssue[] {
  const issues: CatalogIssue[] = [];
  const seen = new Set<string>();
  const validFloors = new Set<number>(FLOOR_IDS);

  for (const s of stores) {
    if (seen.has(s.id)) issues.push({ storeId: s.id, message: 'duplicate store id' });
    seen.add(s.id);
    if (!validFloors.has(s.floorId)) issues.push({ storeId: s.id, message: `unknown floor ${s.floorId}` });
    if (s.serviceablePincodes.length === 0) {
      issues.push({ storeId: s.id, message: 'serviceablePincodes is empty' });
    }
    for (const p of s.serviceablePincodes) {
      if (!parsePincode(p).ok || p !== p.trim()) {
        issues.push({ storeId: s.id, message: `malformed pincode "${p}"` });
      }
    }
    if (s.merchantUrl !== undefined && !/^https:\/\/[^\s]+$/.test(s.merchantUrl)) {
      issues.push({ storeId: s.id, message: `merchantUrl must be an https URL, got "${s.merchantUrl}"` });
    }
    if (new Set(s.serviceablePincodes).size !== s.serviceablePincodes.length) {
      issues.push({ storeId: s.id, message: 'duplicate pincodes in serviceablePincodes' });
    }
  }
  return issues;
}
