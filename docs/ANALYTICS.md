# Analytics

Everything here is local to the visitor's device. Nothing is sent anywhere; the only way data leaves is the visitor pressing **Export Telemetry (CSV)**.

Source of truth: `src/analytics/telemetry.ts` (events, log, CSV), `src/analytics/metrics.ts` (funnel, heat map), `src/analytics/cluster.ts` (PIN → cluster), `src/components/analytics/` (dashboard).

## 1. Event dictionary

| `event_type` | Fired when | `item_id` | Dedupe / rule | Emitted from |
| --- | --- | --- | --- | --- |
| `PINCODE_SUBMITTED` | A valid PIN is accepted at the gate | `null` | Invalid input emits nothing | `ui/PincodeGate.tsx` |
| `STORE_IMPRESSION` | A storefront is on screen for the first time this session | store id | Once per store per page load (`ImpressionTracker`); scanned every 250 ms | `ui/MallCanvas.tsx` |
| `STORE_HOVER_DWELL` | The pointer rests on one store for **≥ 3000 ms** | store id | Once per hover episode; moving away resets (`DwellTracker`) | `ui/MallCanvas.tsx` |
| `STORE_MODAL_OPENED` | A storefront is clicked and its detail modal opens | store id | Every open | `ui/MallCanvas.tsx` |
| `PRODUCT_SAVED_LOOKBOOK` | "Save to lookbook" is pressed and the store becomes saved | store id | Un-saving emits nothing | `ui/StoreModal.tsx` |
| `EXTERNAL_MERCHANT_ROUTED` | "Visit merchant" is clicked (opens the merchant's `https` page) | store id | Every click; only stores with a `merchantUrl` offer the link | `ui/StoreModal.tsx` |
| `MOOD_SELECTED` | A mood is chosen in the Directory drawer | mood id | De-selecting emits nothing | `ui/Directory.tsx` |

Each event is validated before it is stored (`validateEvent`). Invalid events are **rejected, counted and warned about**, never silently stored: PIN must be 6 digits, timestamp ISO-8601 UTC, `match_score` within [0,1], ids must match `^[A-Za-z0-9][A-Za-z0-9._:-]{0,63}$` (this also rules out CSV formula injection such as a leading `=`).

### Context fields

* `match_score` – the store's mood-fit score at that moment (see `RECOMMENDATION_ENGINE.md`), or `null` when no mood is active.
* `user_mood_vector` – the active mood as a one-hot vector over all mood ids (active = 1), or `null` when no mood is active. It is the visitor's *current selection*, not an inferred taste profile.

## 2. Metric definitions

Zero denominators give `null` (shown as "—"), never 0%.

### Conversion funnel

Stages, in order: **Impression → Hover / Dwell → Detail Modal Open → Save to Lookbook → External Link Click**.

A *journey* is a distinct `(session_id, item_id)` pair. Let `R_k` be the set of journeys with a stage-k event, and define the cumulative sets

```
S_1 = R_1
S_k = S_{k-1} ∩ R_k            (k ≥ 2)
```

| Metric | Formula |
| --- | --- |
| Count at stage k | `|S_k|` |
| Conversion from previous | `|S_k| / |S_{k-1}|` (k ≥ 2), `null` if `|S_{k-1}| = 0` |
| Drop-off from previous | `1 − conversion from previous` |
| Conversion from top | `|S_k| / |S_1|`, `null` if `|S_1| = 0` |
| Skipped-prior (data-quality note) | `|R_k \ S_{k-1}|`: journeys that logged stage k without completing every earlier stage |

Because `S_k ⊆ S_{k-1}`, counts never increase down the funnel and drop-off is never negative. Event *order in time* is not required, only that the stage was reached. A click on a store without a 3 s dwell is counted in "skipped-prior" and not in the funnel; that is deliberate and visible in the table.

### Pincode-cluster × mood heat map

* **Cluster** of a PIN: the first named delivery zone containing it (`zonesContaining`), else the first three digits (`PIN 682xxx`).
* **Session → cluster**: the PIN of the session's *last* `PINCODE_SUBMITTED`; if none, the PIN on its first event.
* **Cell** (cluster *c*, mood *m*): `engaged / sessions`, where
  * `sessions` = distinct sessions assigned to *c* (any session with at least one event),
  * `engaged` = of those, sessions with ≥ 1 `MOOD_SELECTED` where `item_id = m`. A session counts once per mood however many times it picks it.
* Clusters with fewer than **5 sessions** are flagged "low n". Small-n percentages are shown but should not be over-read.

## 3. Storage and privacy

* Events are kept in memory and `localStorage` (`cybermall2000.telemetry.v1`), capped at **5,000** events (oldest dropped). Corrupt stored rows are discarded on load; unavailable storage degrades to memory-only.
* `session_id` is a random UUID created per page load; it is not derived from anything about the visitor.
* A PIN code is location data. It stays on the device, and the dashboard has a **Clear stored telemetry** button.

## 4. CSV export

`eventsToCsv` writes RFC 4180, UTF-8, `\n` line endings, **no BOM** (a BOM corrupts the first column name in pandas), one header row, one row per event in chronological order. File name: `cybermall_telemetry_YYYYMMDD-HHMMSSZ.csv` (UTC).

| Column | Type | Null as | Notes |
| --- | --- | --- | --- |
| `session_id` | string (UUID) | never null | |
| `timestamp` | ISO-8601 UTC, ms precision | never null | e.g. `2026-10-24T09:15:02.123Z` |
| `pincode` | string, 6 digits | never null | Keep as text: leading digits are significant for clustering |
| `event_type` | one of the seven types above | never null | |
| `item_id` | string | empty | store id, mood id, or empty for `PINCODE_SUBMITTED` |
| `match_score` | decimal in [0,1], ≤ 4 dp | empty | |
| `user_mood_vector` | JSON object `{"mood-id": 0 or 1, …}`, keys sorted | empty | Quoted per RFC 4180 because it contains commas |

```python
import pandas as pd, json
df = pd.read_csv("cybermall_telemetry_….csv", dtype={"pincode": "string"}, parse_dates=["timestamp"])
df["mood"] = df["user_mood_vector"].dropna().map(json.loads)
```

Power BI: import as Text/CSV (UTF-8), set `pincode` to Text, and parse `user_mood_vector` with *Transform → Parse → JSON*. SQL: load with a `TEXT` column for `pincode` and `user_mood_vector`.

## 5. Known limits

* The funnel is per page-load session; there is no cross-device identity.
* `STORE_IMPRESSION` means "was within the viewport", not "was read".
* The sample catalog has no `merchantUrl`s, so the last funnel stage stays at zero until real merchant links exist (Floor 6 streaming platforms do carry their real home pages).
* No statistical tests are applied; with small samples the heat map is descriptive only.
