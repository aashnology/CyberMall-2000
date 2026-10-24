/**
 * Audit the shipped delivery zones against the official India Post directory.
 *   npm run audit:zones -- path/to/all_india_pincode_directory.csv
 * Exits non-zero if any zone has unknown PINs, district mismatches or non-delivery PINs.
 */
import { readFileSync } from 'node:fs';
import { parseIndiaPostCsv, PincodeDirectory, auditZones } from '../src/data/indiaPost';
import { ZONE_DEFINITIONS } from '../src/data/pincodeZones';

const file = process.argv[2];
if (file === undefined) { console.error('Usage: npm run audit:zones -- <india-post-directory.csv>'); process.exit(2); }
const dir = new PincodeDirectory(parseIndiaPostCsv(readFileSync(file, 'utf8')));
console.log(`Loaded ${dir.size} distinct PIN codes.`);
let bad = 0;
for (const a of auditZones(ZONE_DEFINITIONS, dir)) {
  if (a.clean) { console.log(`OK    ${a.zoneId}`); continue; }
  bad += 1;
  console.log(`FIX   ${a.zoneId}`);
  if (a.unknownPins.length) console.log(`        unknown PINs: ${a.unknownPins.join(', ')}`);
  for (const m of a.districtMismatches) console.log(`        ${m.pincode} is in district ${m.districts.join(' / ')}`);
  if (a.nonDelivery.length) console.log(`        no delivery office: ${a.nonDelivery.join(', ')}`);
}
process.exit(bad === 0 ? 0 : 1);
