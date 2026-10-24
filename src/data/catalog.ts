/**
 * The ONE place the app reads its store catalog from.
 * Swap SAMPLE_CATALOG for your real catalog (same `Store` shape) and nothing else changes.
 */
import { SAMPLE_CATALOG } from './catalog.sample';
import type { Store } from './types';

export const CATALOG: readonly Store[] = SAMPLE_CATALOG;
