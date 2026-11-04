# CyberMall 2000

**A mood-first virtual mall that pairs Y2K spatial nostalgia with hyper-local delivery analytics.**
Walk a 2.5D galleria, enter your postal PIN, and see which stores actually deliver to your doorstep.

**Live demo:** <https://aashnology.github.io/CyberMall-2000/>

Docs: [Architecture](docs/ARCHITECTURE.md) · [Recommendation engine](docs/RECOMMENDATION_ENGINE.md) · [Analytics](docs/ANALYTICS.md)

Author: **Aashna**

---

## Why this exists

CyberMall 2000 has two goals.

1. **Accessible, inclusive spatial retail.** A physical mall asks a lot of a visitor: distance, stairs, crowds, noise, sensory load. CyberMall 2000 offers the same exploratory, browse-by-wandering experience from any browser. You move at your own pace, with keyboard, pointer or touch, and can switch the sound off at any time.
2. **A hyper-local discovery hub.** If you have just moved to a neighbourhood, or you want to follow independent fashion, cafe, media and lifestyle brands, the question that matters is *"does it deliver to my PIN?"* The mall answers that first, then helps you browse by mood.

> **Honest status.** The mall currently ships with a **sample catalogue of fictional brands** (`src/data/catalog.sample.ts`) and **illustrative Floor 6 showtime fixtures**; the UI labels them as sample data. The delivery engine, pincode directory, telemetry, scoring loop and analytics are real and tested. Connecting a real merchant catalogue is the next data task, and is the subject of [the open engineering question below](#the-open-engineering-question).
> Accessibility is a design goal, not a certified claim: keyboard movement, a persistent mute and ARIA labelling are in place, but a formal screen-reader and WCAG audit has not been done yet.

---

## What you can do today

| Feature | What it does |
| --- | --- |
| **Pincode gate** | A valid 6-digit PIN is mandatory. It calibrates delivery status for every store. The field starts blank; no PIN is ever suggested or prefilled. |
| **Delivery-aware directory** | Stores that do not deliver to your PIN show a `DOES NOT DELIVER TO <PIN>` ribbon and rank lower. A toggle hides them entirely. The "Visit Official Website" link stays available. |
| **Mood matching** | Pick a mood (Jazz-Club Elegance, Corporate Chic, Cozy Sunday, Self-Care Reset). Each result shows the exact numbers behind its score. |
| **Nine floors** | 1 Apparel & Fashion · 2 Books, Stationery & Media · 3 Accessories & Fine Jewelry · 4 Specialty Hobby, Toys & Collectibles · 5 Beauty, Cosmetics & Personal Grooming · 6 Theatre and OTT · 7 Food Court and Arcade · 8 Cafes · 9 Pharmaceuticals, Clinical Wellness & Apothecaries |
| **Chibi avatar** | Layered SVG Y2K avatar with a customiser and walk cycle. |
| **Retro photobooth** | On Floor 7. Uses your camera (with your permission), a countdown and four shots, then exports a 35mm photostrip as PNG or JPEG. If the camera is denied, chibi avatar poses are used instead. Video tracks stop when the booth closes. |
| **Sky that follows your clock** | Day and night from your device time, plus seasonal touches (winter snow, autumn foliage). No network call involved. |
| **Spatial audio** | Web Audio ambient beds that crossfade by proximity, retro UI sounds, and a mute that persists. |
| **Analytics dashboard** | Conversion funnel, PIN-cluster by mood heat map, a Learned Lift panel showing what the scoring loop has adjusted, and a one-click `Export Telemetry (CSV)`. |

**Controls:** WASD / arrow keys or click to walk · mouse wheel to zoom · `M` map · `L` directory · `E` elevator (near the start of the concourse) or photobooth (Floor 7) · `1`-`9` inside the elevator. Sound starts after your first click or keypress.

---

## Tech stack

| Layer | Choice |
| --- | --- |
| Framework | React 19, TypeScript (strict), Vite |
| State | Zustand; everything persisted in `localStorage` |
| Styling | Hand-written CSS with design tokens: Burgundy `#58111A`, Antique Gold `#C5A059`, Champagne `#EFE5D2`, Espresso `#2B1E1A` |
| Rendering | Lightweight 2.5D canvas scene with clamped avatar movement; marble floor generated in a Web Worker |
| Audio | Web Audio API, equal-power proximity crossfade |
| Delivery data | India Post pincode directory (19,117 distinct PINs in the source CSV), exact-PIN matching |
| Analytics and learning | Pure-function telemetry pipeline, empirical-Bayes shrunk lift scoring, Recharts dashboard |
| Tests | Vitest and Testing Library (logic and component tests) |
| Hosting | Static build for GitHub Pages (`base: './'`), deployed by a GitHub Actions workflow on every push to `main` (tests, typecheck, build, publish); no backend |

Everything runs in your browser. The only data that ever leaves the device is a file you choose to export.

---

## How the recommendations work

Short version (full derivation and limits in [docs/RECOMMENDATION_ENGINE.md](docs/RECOMMENDATION_ENGINE.md)):

```
score(store) = fit'(store) × g(delivery status)

fit'  = min(1, W_mood[subcategory] × lift)     W = hand-authored editorial prior in [0, 1]
g     = 1.00 delivers · 0.85 unknown · 0.15 does not deliver
```

**Delivery gating.** Because `g(not deliverable) = 0.15`, any deliverable store with fit of at least 0.15 outranks every non-deliverable one.

**The scoring loop.** The telemetry log feeds back into the score through a learned per-(mood, subcategory) *lift*. Each journey is one `(session, store, mood)` that began with an impression, weighted by the deepest stage it reached (dwell 0.25, modal 0.50, lookbook save 0.75, merchant click 1.00). The cell's rate is shrunk toward the mood's pooled rate:

```
rate = (s + K × p) / (n + K)        K = 10 pseudo-journeys
lift = clamp(rate / p, 0.5, 1.5)
```

With no data, `lift = 1` and the engine is exactly the editorial prior. The clamp bounds telemetry to a ±50 % change, and a zero prior stays zero, so the loop reorders categories a mood already admits and never invents affinity. Impressions of stores that cannot deliver to the visitor's PIN are excluded from learning. Each result carries a `why` string such as `skincare fit 1.00 × learned lift 1.12 (n=18) × delivery 1.00 (delivers)`.

**Limits, stated plainly.** The weights, `K`, the clamp and the stage weights are design constants, not estimates. The log lives in one browser, so the loop learns from that visitor's history rather than a population. Ranking influences clicks, so lifts partly measure the ranking itself. A held-out check that the learned lifts beat the priors is not built yet.

## How the analytics work

Every interaction is a typed event: `PINCODE_SUBMITTED`, `STORE_IMPRESSION`, `STORE_HOVER_DWELL` (3 s or more), `STORE_MODAL_OPENED`, `PRODUCT_SAVED_LOOKBOOK`, `EXTERNAL_MERCHANT_ROUTED`, `MOOD_SELECTED`, `PHOTOBOOTH_STRIP_GENERATED`. Events are validated before storage, kept on your device (capped at 5,000), and exportable as CSV.

The funnel is cumulative over distinct `(session, store)` journeys:

`Impression → Hover / Dwell → Detail Modal → Save to Lookbook → External Link Click`

so counts can only fall from one stage to the next. The heat map shows the share of sessions that engaged, per PIN cluster and mood. Definitions and known limits are in [docs/ANALYTICS.md](docs/ANALYTICS.md).

---

## The open engineering question

**Automated regional delivery verification across fragmented e-commerce platforms.**

Large platforms and small direct-to-consumer brands check pincode serviceability behind private APIs, session cookies, GraphQL endpoints or reverse-geocoded coordinates. There is no standard public interface.

CyberMall 2000 does not scrape, and will not. The question is how to keep regional delivery reach accurate across thousands of independent merchants **sustainably, privately and within each site's terms of service**, without brittle headless-browser scraping.

Directions worth discussing:

* a merchant-published, standardised serviceability feed or schema (static JSON, or a webhook on change);
* merchant opt-in registration of serviceable PIN ranges;
* platform-provided partner APIs, where they exist;
* how often such data goes stale, and how to show that staleness honestly to shoppers.

If you work on data engineering, open catalogue standards or merchant integrations, please open an issue or start a discussion on this repository.

---

## Milestones

| Date | What landed |
| --- | --- |
| Oct 22 | Chibi avatar system and structured multi-floor layout |
| Oct 24 | v2 prototype: pincode delivery engine, 2.5D scene, telemetry, dashboard, spatial audio, docs |
| Oct 25 | Clock-driven seasonal skybox; Floor 7 Food Court and Arcade with photobooth kiosk |
| Oct 26-28 | Camera photobooth and 35mm photostrip export; GitHub Pages-ready static build |
| Nov 3 | GitHub Actions deployment; telemetry-driven scoring loop and Learned Lift panel |

## Roadmap

Nothing below is built yet.

* **V3 Gaming Arcade:** playable retro mini-games in the Floor 7 arcade wing (currently a "Coming Soon in V3" facade).
* **Multi-user presence:** see other shoppers on the concourse (needs a real-time backend, which is a deliberate later milestone).
* **Structured ingestion:** merchant catalogue and showtime feeds, replacing today's sample data.

---

## Local setup

```bash
git clone https://github.com/aashnology/CyberMall-2000.git
cd CyberMall-2000
npm install
npm run dev          # http://localhost:5173
npm test             # Vitest
npm run build        # typecheck + production build
npm run preview      # serve the production build
```

Other scripts: `npm run typecheck`, `npm run audit:zones -- path/to/pincodes.csv`.

## Repository map

| Area | Path |
| --- | --- |
| Pincode parsing, delivery status | `src/engine/pincode.ts` |
| Telemetry, funnel, heat map | `src/analytics/`, `src/components/analytics/` |
| Concourse geometry | `src/spatial/concourse.ts` |
| Scene and skybox | `src/scene/` |
| Avatar | `src/avatar/` |
| Photobooth and photostrip | `src/photobooth/`, `src/utils/photostripGenerator.ts` |
| Spatial audio | `src/audio/spatialAudio.ts` |
| Mood matching | `src/data/moods.ts` |
| Scoring loop | `src/engine/scoringLoop.ts`, `src/analytics/learnedLifts.ts` |
| Deployment | `.github/workflows/deploy.yml` |
| Tests | `tests/` |
