import { zonesContaining } from '../data/pincodeZones';

export interface Cluster { readonly id: string; readonly label: string }

/**
 * PIN → cluster for the affinity heat map.
 * 1. A named delivery zone (first match) if the PIN is in one.
 * 2. Otherwise the postal sorting district: the first three digits.
 */
export function clusterForPincode(pincode: string): Cluster {
  const zone = zonesContaining(pincode)[0];
  if (zone !== undefined) return { id: zone.id, label: zone.label };
  const prefix = pincode.slice(0, 3);
  return { id: `pin3-${prefix}`, label: `PIN ${prefix}xxx` };
}
