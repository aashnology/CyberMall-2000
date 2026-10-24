# CyberMall 2000 · v2

Hyper-local neighbourhood retail discovery, staged as a C-shaped 2.5D galleria. Author: **Aashna**.

> Discover what genuinely delivers to your doorstep in your new neighbourhood.

## Run

```bash
npm install
npm run dev          # http://localhost:5173
npm run typecheck    # strict TypeScript
npm test             # Vitest (logic + component tests)
npm run build        # typecheck + production build
npm run preview
```

Controls: sound starts on your first click or keypress (toggle: **Sound** in the top bar) · WASD / arrows or click to walk · wheel to zoom · `M` map · `L` directory · `E` elevator (near the start of the concourse) · `1`–`9` in the elevator.

## What is here

| Area | Where |
| --- | --- |
| Pincode parsing, delivery status, ribbon, directory (never truncates) | `src/engine/pincode.ts` |
| Delivery-zone graph + India Post ingest/audit | `src/data/pincodeZones.ts`, `src/data/indiaPost.ts` |
| C-concourse geometry, dense-floor scaling, "You Are Here" path | `src/spatial/concourse.ts` |
| Polished-marble floor (no checkerboard) | `src/render/marbleFloor.ts` |
| 2.5D scene: coast, glass wall, atrium waterfall, centerpiece, banners, day/night | `src/scene/drawScene.ts` |
| Chibi avatar (SVG layers, walk cycle) | `src/avatar/` |
| Floors, wellness partition (Floor 5 vs 9) | `src/data/types.ts`, `src/data/wellnessPartition.ts` |
| Floor 6 snapshot fixtures | `src/data/mediaSnapshots.ts` |
| Mood matching (explainable) | `src/data/moods.ts` |

## Data you must replace or verify

* `src/data/catalog.sample.ts` is **sample data with fictional brands**. Point `src/data/catalog.ts` at the real catalog (same `Store` shape, with `serviceablePincodes`).
* `src/data/pincodeZones.ts` is **seed data, marked `seed-unverified`**. Download the All-India Pincode Directory CSV (data.gov.in) and run `npm run audit:zones -- path/to/file.csv`; fix what it reports.
* `src/data/mediaSnapshots.ts` holds **fixtures** (showtimes are illustrative). The UI labels them as sample data.

| Typed telemetry, funnel + PIN×mood heat map, CSV export | `src/analytics/`, `src/components/analytics/` |
| Spatial audio (synthesised, proximity crossfade, retro SFX, persistent mute) | `src/audio/spatialAudio.ts` |
| Documentation | `docs/ARCHITECTURE.md`, `docs/RECOMMENDATION_ENGINE.md`, `docs/ANALYTICS.md` |

## Utilities

```bash
npm run audit:zones -- file.csv                  # check delivery zones against the India Post directory
npx tsx scripts/renderAudioDemo.ts demo.wav      # render a listenable demo of the audio engine
```

## Scope notes

* Deployment / hosting configuration is intentionally absent.
* The analytics dashboard shows only what the visitor's own device recorded; there is no seeded or demo data in the app.
