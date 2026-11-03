# Recommendation engine

This document specifies what the engine **actually does today** (`src/data/moods.ts`, `src/engine/scoringLoop.ts`, `src/engine/pincode.ts`). §1–§5 describe the editorial scorer; §6 describes the telemetry loop that adjusts it. It is deliberately small and fully explainable. Section 7 lists ideas that are *not* implemented.

## 1. Scoring

Let `i` be a store, `c(i)` its `subcategory`, and `m` a mood with a weight table `W_m : subcategory → [0,1]` (absent = 0). The visitor's mood vector `v` is one-hot (`v_m = 1` for the selected mood, else 0).

```
fit(i)   = Σ_m  v_m · W_m[c(i)]            = W_{m*}[c(i)]     for the selected mood m*
score(i) = fit(i) · g(status(i))
```

`score ∈ [0,1]` because both factors are in [0,1]. A store with no affinity (`fit = 0`) is not listed for that mood.

### Mood weight tables (editorial priors)

| Mood | Heavier weights |
| --- | --- |
| 1990s Jazz-Club Elegance | fine jewelry 1.0 · watches 0.9 · coffee roaster 0.8 · music 0.8 · fragrance 0.7 · womenswear 0.6 · bags 0.6 |
| Corporate Chic | menswear 1.0 · womenswear 0.8 · watches 0.8 · bags 0.7 · stationery 0.6 · footwear 0.6 · cafe 0.5 |
| Cozy Sunday | books 1.0 · bakery 0.9 · tea room 0.9 · cafe 0.8 · bath-body 0.6 · board games 0.6 · stationery 0.5 |
| Self-Care Reset | skincare 1.0 · bath-body 0.9 · salon 0.8 · haircare 0.7 · ayurveda 0.7 · supplements 0.6 · fragrance 0.6 |

These weights are **hand-authored priors**. Telemetry adjusts them only through the bounded lift in §6; the priors themselves are never overwritten. The only way to claim they are good is to measure them (see §7).

## 2. Delivery gating

Delivery status comes from exact PIN membership in a store's `serviceablePincodes` (no prefix matching).

| Status | Meaning | `g` (score factor) | In the directory |
| --- | --- | --- | --- |
| `delivers` | PIN is in the store's list | 1.00 | normal |
| `unknown` | no PIN to test (not reachable after the mandatory gate; used by Floor 6) | 0.85 | normal |
| `not-deliverable` | PIN is not in the list | 0.15 | greyed with the ribbon `DOES NOT DELIVER TO <PIN>` |

Two layers:

1. **Soft gate** (always on): non-deliverable stores are strongly down-weighted (×0.15) but still visible, so the visitor learns *why* something is out of reach.
2. **Hard gate** (checkbox "Only stores that deliver to me"): non-deliverable stores are removed from the directory entirely. Order of the remaining stores is unchanged so storefronts do not jump when the PIN changes.

`g` is a design constant, not a probability. Consequence: a non-deliverable store can never score above 0.15, so **any deliverable store with fit ≥ 0.15 outranks every non-deliverable store**. Below that, a strong non-deliverable store (fit `f_n`) can still rank above a very weak deliverable one (fit `f_d`) exactly when `f_d < 0.15 · f_n`. For equal positive fit, the deliverable store always wins.

## 3. Ranking

`matchMood` sorts by `score` descending, ties by store name (locale compare). Each result carries a `why` string showing the exact numbers (`<subcategory> fit 0.80 × delivery 1.00 (delivers)`), and the same score is written to telemetry as `match_score`.

## 4. Cold start

* **No mood selected**: nothing is scored. The Directory shows the floor's stores in catalog order and the mood tab says so. No default mood is assumed (a silent default would inject false `MOOD_SELECTED` signals into analytics). `match_score` and `user_mood_vector` are `null` in telemetry.
* **New PIN with no history**: delivery gating works immediately (it needs no history). There is no popularity prior and no per-PIN personalisation yet.
* **A store whose subcategory appears in no mood table** simply never matches a mood; it remains browsable.

## 5. Properties covered by tests (`tests/state.test.ts`, `tests/analytics.test.ts`)

* scores lie in [0,1] for every store × mood × delivery status;
* results are sorted by non-increasing score and every result carries its explanation;
* a non-deliverable store scores strictly below a deliverable one of equal fit;
* the mood vector is one-hot over all mood ids.

## 6. Scoring loop (telemetry → lift → score)

The log feeds the scorer. `computeLifts(events, catalog, moods)` is a pure function of the telemetry events (`src/engine/scoringLoop.ts`); `useLearnedLifts()` recomputes it whenever the log changes, and `matchMood`, `scoreEntry`, the store modal and the `match_score` written to telemetry all use the same table.

```
journey (s, i, m)  = session s saw store i under mood m   (STORE_IMPRESSION carrying mood m's one-hot vector)
y(s, i, m)         = weight of the deepest stage reached under the SAME mood:
                     dwell 0.25 · modal open 0.50 · lookbook save 0.75 · merchant click 1.00 · none 0
n_mc = #journeys of mood m, subcategory c      s_mc = Σ y         p_m = Σ_c s_mc / Σ_c n_mc

rate_mc = (s_mc + K·p_m) / (n_mc + K)          K = 10 pseudo-journeys
lift_mc = clamp(rate_mc / p_m, 0.5, 1.5)       (1 if p_m = 0)
fit'(i) = min(1, W_m[c(i)] · lift_mc)          score(i) = fit'(i) · g(status(i))
```

Why this shape:

* **Cold start is the prior.** No data ⇒ `n_mc = 0` ⇒ `rate_mc = p_m` ⇒ `lift = 1`. The engine reproduces §1 exactly until visitors generate evidence.
* **Shrinkage.** `K` blends each cell with its mood's pooled rate, so one lucky click cannot swing a category; the weight on the cell's own data is `n/(n+K)` (50 % at 10 journeys).
* **Bounded drift.** The clamp lets telemetry move a prior by at most ±50 %. A zero prior stays zero: the loop reorders and rescales categories a mood already admits, it never invents affinity. Scores stay in [0,1].
* **Deliverability is excluded from learning.** Impressions of stores that do not deliver to that PIN are dropped (they cannot convert by construction; including them would teach the engine that their category is unpopular). Delivery is derived by joining the event's `pincode` with the catalog's `serviceablePincodes`.
* **Explainable.** The `why` string gains `× learned lift 1.12 (n=18)` once a cell has data.

`K`, the clamp and the stage weights are **design constants, not estimates**, in the same sense as `g` in §2.

Counted but not used: impressions with no mood, with a store id missing from the catalog, or with a non-deliverable store are tallied in `LiftTable.diagnostics`.

Known limits (stated, not hidden):

* **Position/exposure feedback.** Ranking affects what gets clicked, so lifts partly measure the ranking they produced. The clamp bounds the effect; removing it needs randomised ordering, which is not implemented.
* **Single-device log.** The log is per browser (`localStorage`, capped at 5,000 events), so the loop learns from this visitor's history, not a population. Population-level learning needs the later multi-user milestone.
* **Pooled rate is noisy when a mood has few journeys.** Example: one hit against many misses elsewhere in the mood gives a large raw ratio; the clamp is what protects the score there.
* **Outcome weights are editorial.** Stage values are not fitted to any ground-truth conversion.

Properties covered by tests (`tests/scoringLoop.test.ts`): empty log ⇒ prior unchanged; attribution rules (same-mood outcomes only, deepest stage, de-duplication, excluded impressions); closed-form pooled rate and shrunk rate; clamp bounds; scores in [0,1]; zero prior never promoted; sort order; end-to-end through `TelemetryLog`.

## 7. Not implemented (proposals; require approval before any work)

* **Multi-mood blending** (`v` with several non-zero entries) and a normalisation rule.
* **A held-out check** that the learned lifts (§6) actually beat the hand-authored priors; §6 learns from telemetry but does not yet prove it helps.
* **PIN-cluster popularity prior** as a cold-start fallback, shrunk toward the global rate when a cluster has few sessions.
* **Calibrating `g`** from observed behaviour on non-deliverable stores.
