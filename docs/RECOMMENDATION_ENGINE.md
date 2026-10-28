# Recommendation engine

This document specifies what the engine **actually does today** (`src/data/moods.ts`, `src/engine/pincode.ts`). It is deliberately small and fully explainable. Section 6 lists ideas that are *not* implemented.

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

These weights are **hand-authored priors, not learned from data**. The only way to claim they are good is to measure them (see §6).

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

## 6. Not implemented (proposals; require approval before any work)

* **Multi-mood blending** (`v` with several non-zero entries) and a normalisation rule.
* **Learning the weight tables** from `STORE_MODAL_OPENED` / `PRODUCT_SAVED_LOOKBOOK` outcomes, with a held-out check that learned weights beat the hand-authored priors.
* **PIN-cluster popularity prior** as a cold-start fallback, shrunk toward the global rate when a cluster has few sessions.
* **Calibrating `g`** from observed behaviour on non-deliverable stores.
