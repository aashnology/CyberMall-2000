/**
 * The 4-shot capture timeline as a pure function of elapsed time:
 *   per shot:  3 … 2 … 1 …  FLASH! (capture at the instant the flash starts)  … short hold
 */

export const SHOTS = 4;
export const COUNT_FROM = 3;
export const COUNT_MS = 800;
export const FLASH_MS = 260;
export const HOLD_MS = 440;
export const SHOT_MS = COUNT_FROM * COUNT_MS + FLASH_MS + HOLD_MS;
export const TOTAL_MS = SHOTS * SHOT_MS;

export type SeqPhase =
  | { readonly kind: 'count'; readonly shot: number; readonly count: number }
  | { readonly kind: 'flash'; readonly shot: number }
  | { readonly kind: 'hold'; readonly shot: number }
  | { readonly kind: 'done' };

export function phaseAt(elapsedMs: number): SeqPhase {
  if (!(elapsedMs >= 0)) return { kind: 'count', shot: 0, count: COUNT_FROM };
  if (elapsedMs >= TOTAL_MS) return { kind: 'done' };
  const shot = Math.floor(elapsedMs / SHOT_MS);
  const t = elapsedMs - shot * SHOT_MS;
  if (t < COUNT_FROM * COUNT_MS) return { kind: 'count', shot, count: COUNT_FROM - Math.floor(t / COUNT_MS) };
  if (t < COUNT_FROM * COUNT_MS + FLASH_MS) return { kind: 'flash', shot };
  return { kind: 'hold', shot };
}

/** Elapsed time at which shot `k` is captured (the start of its flash). */
export const captureTime = (k: number): number => k * SHOT_MS + COUNT_FROM * COUNT_MS;

/** Shots whose capture instant falls in (prev, now]. Exactly-once, whatever the frame rate. */
export function capturesBetween(prevMs: number, nowMs: number): number[] {
  const out: number[] = [];
  for (let k = 0; k < SHOTS; k += 1) { const c = captureTime(k); if (c > prevMs && c <= nowMs) out.push(k); }
  return out;
}

/** Countdown ticks (the start of each "3", "2", "1") in (prev, now]. Use prev = -1 to include t = 0. */
export function ticksBetween(prevMs: number, nowMs: number): Array<{ shot: number; count: number }> {
  const out: Array<{ shot: number; count: number }> = [];
  for (let k = 0; k < SHOTS; k += 1) for (let j = 0; j < COUNT_FROM; j += 1) {
    const at = k * SHOT_MS + j * COUNT_MS;
    if (at > prevMs && at <= nowMs) out.push({ shot: k, count: COUNT_FROM - j });
  }
  return out;
}
