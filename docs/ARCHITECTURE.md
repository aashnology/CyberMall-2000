# Architecture

## 1. Layers and data flow

```
 CATALOG (src/data/catalog.ts)            Floor 6 fixtures (mediaSnapshots.ts)
        │  Store[] with serviceablePincodes        │
        ▼                                          ▼
 buildDirectory(stores, {pincode, onlyDeliverable})      buildFloor6(pincode)
        │  DirectoryResult.byFloor[floor] : DirectoryEntry[]   (status, ribbon)
        ▼
 entries  (the current floor's DirectoryEntry[])
        │
        ├──► layoutFloor(entries.length) ──► FloorLayout.placements[]   (one placement per entry, same index)
        │
        ▼
 MallCanvas  ── requestAnimationFrame loop ──► drawScene(ctx, SceneState)        (canvas 2.5D)
        │                                        ▲ camera, sky(time), banners, marble floor layer
        ├──► walker (concourse coords) ◄── keyboard / pointer
        ├──► telemetry  (impressions, dwell, modal, …)  ──► TelemetryLog ──► dashboard / CSV
        └──► audio      (proximity → bed crossfade)      ──► SpatialAudio
```

**Contract between data and layout:** `layout.placements[i]` positions `entries[i]`. Any floor layout (the C-shaped concourse, or a straight promenade) can be swapped in by providing `layoutFloor(count)` and the scene's draw functions; nothing in the directory, telemetry, audio or analytics code depends on the geometry.

## 2. Module map

| Area | Files | Pure? |
| --- | --- | --- |
| Domain types, floors | `data/types.ts` | yes |
| Pincode parsing, delivery, directory, catalog validation | `engine/pincode.ts` | yes |
| Delivery zones + India Post ingest/audit | `data/pincodeZones.ts`, `data/indiaPost.ts`, `scripts/auditZones.ts` | yes |
| Mood scoring | `data/moods.ts` | yes |
| Banner rotation | `engine/banners.ts` | yes (time injected) |
| Floor 5/9 partition rule | `data/wellnessPartition.ts` | yes |
| Floor 6 snapshot fixtures | `data/mediaSnapshots.ts`, `data/floor6.ts` | yes |
| Layout geometry, walking coordinates | `spatial/concourse.ts` | yes |
| Movement, time of day, hit testing | `scene/movement.ts`, `scene/timeOfDay.ts`, `scene/interaction.ts` | yes |
| Rendering | `scene/drawScene.ts`, `render/marbleFloor.ts` (+ `marbleWorker.ts`), `avatar/renderAvatar.ts` | draw fns take a context |
| Telemetry | `analytics/telemetry.ts`, `metrics.ts`, `cluster.ts`, `track.ts`, `instance.ts` | core is pure |
| Audio | `audio/spatialAudio.ts`, `audio/instance.ts` | runs on any `BaseAudioContext` |
| UI | `ui/*`, `components/analytics/*`, `App.tsx` | React |

Rule: **business logic never lives in the presentation layer.** Components read state, call pure functions and render.

## 3. Canvas coordination

* World units are abstract (≈ metres). `Camera {cx, cy, zoom}` maps world → screen; the camera eases toward the avatar every frame.
* The frame loop (one `requestAnimationFrame`) does, in order: step the walker → ease the camera → `drawScene` → place the avatar overlay (DOM `transform`, no React render) → throttled side channels (impressions every 250 ms, audio proximity every 200 ms, walker publish every 100 ms).
* All animation is a function of `timeMs`, so the renderer can be exercised headlessly (`scripts/renderScenePreview.ts`).
* The marble floor is the expensive pixel pass; it renders **once per radius in a Web Worker** and is cached as an offscreen canvas. A flat band is drawn until it arrives.
* The avatar is a DOM-overlaid SVG; only the 8-step walk bucket, facing and walking flag are React state (changes ≤ ~12 Hz), the position is written straight to the element style.
* The clock is the device's own (or a manual override): the **only real-time inputs** are the system time (day/night) and the PIN-based delivery zone.

## 4. State management

| State | Where | Persisted |
| --- | --- | --- |
| PIN, "only deliverable", avatar, lookbook | Zustand `mallStore` | `localStorage`, validated field by field on load (`state/persist.ts`) |
| Floor, panel, selected store, active mood, hour | Zustand | no |
| Walker, camera, hover, floor layer, trackers | `useRef` inside `MallCanvas` | no |
| Live "you are here" for the map | `state/walkerBus.ts` (pub/sub, ≤ 10 Hz) | no |
| Telemetry events | `TelemetryLog` | `localStorage`, capped, validated |
| Mute | `SpatialAudio` | `localStorage` |

The PIN gate is mandatory: with no valid PIN, `App` renders only `PincodeGate`, whose input starts empty with no placeholder and no suggestion.

## 5. Failure behaviour

* Missing/!throwing `localStorage` → memory-only, no crash (tested).
* No Web Audio → Sound toggle disabled; no sound is scheduled before the first gesture or while muted.
* No `Worker` → flat floor band, everything else works.
* A rejected telemetry event is counted and warned, never thrown into the UI.

## 6. Testing

`npm test` runs ~170 Vitest tests: pure logic (pincode, zones, layout invariants for every floor size 0–1000, movement properties, funnel/heat-map maths), a numeric no-checkerboard test of the marble, component tests under jsdom (gate, directory, elevator, modal, dashboard, export) that also fail on any `console.error`/`warn`, and **offline Web Audio renders** that measure loudness, spectrum, crossfade smoothness and mute silence.
