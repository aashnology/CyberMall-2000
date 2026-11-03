import { liftReport, SHRINKAGE_K, LIFT_MIN, LIFT_MAX, type LiftTable } from '../../engine/scoringLoop';
import type { Mood } from '../../data/moods';
import { fmtPct } from './format';

/** Position of a lift on a bar that spans [LIFT_MIN, LIFT_MAX]; 1.00 sits at the centre line. */
const pos = (lift: number): number => ((lift - LIFT_MIN) / (LIFT_MAX - LIFT_MIN)) * 100;

export function LearnedLiftPanel({ table, moods }: { readonly table: LiftTable; readonly moods: readonly Mood[] }): React.JSX.Element {
  const report = liftReport(table, moods);
  const d = table.diagnostics;
  const anyData = d.usedJourneys > 0;
  return (
    <section className="an-card" aria-labelledby="lift-title">
      <h3 id="lift-title">Recommendation learning · learned lift per mood × category</h3>
      <p className="muted">
        Each mood starts from an editorial weight. Visitor behaviour on this device (impression → dwell → open → save → merchant click)
        scales that weight by a <em>lift</em> in [{LIFT_MIN}, {LIFT_MAX}], shrunk toward the mood’s average with {SHRINKAGE_K} pseudo-journeys so a few clicks cannot swing it.
        Lift 1.00 = no evidence yet. Effective weight = min(1, prior × lift).
      </p>
      {!anyData && <p className="empty">No mood-tagged journeys yet. Pick a mood in the Directory and open a few stores: lifts start moving from 1.00 as evidence arrives.</p>}
      {report.map((m) => (
        <div key={m.moodId} className="lift-mood">
          <h4>{m.label} <small>· {m.journeys} {m.journeys === 1 ? 'journey' : 'journeys'} · pooled outcome rate {fmtPct(m.pooledRate)}</small></h4>
          <div className="heat-scroll">
            <table className="an-table lift">
              <caption className="sr-only">Learned lift per category for {m.label}</caption>
              <thead><tr><th scope="col">Category</th><th scope="col">Prior</th><th scope="col">n</th><th scope="col">Rate</th><th scope="col">Lift</th><th scope="col">Effective</th></tr></thead>
              <tbody>
                {m.rows.map((r) => (
                  <tr key={r.subcategory} className={r.n === 0 ? 'lift-none' : ''}>
                    <th scope="row">{r.subcategory}</th>
                    <td>{r.prior.toFixed(2)}</td>
                    <td>{r.n}{r.n > 0 && r.n < SHRINKAGE_K && <small title={`Fewer than ${SHRINKAGE_K} journeys: mostly prior`}> · low n</small>}</td>
                    <td>{r.rate === null ? '—' : fmtPct(r.rate)}</td>
                    <td aria-label={`lift ${r.lift.toFixed(2)}`}>
                      <span className="lift-bar" aria-hidden="true"><i className="lift-mid" /><i className="lift-dot" style={{ left: `${pos(r.lift)}%` }} /></span>
                      <b>{r.lift.toFixed(2)}</b>
                    </td>
                    <td>{r.effective.toFixed(2)}{r.effective !== r.prior && <small className={r.effective > r.prior ? ' up' : ' down'}> {r.effective > r.prior ? '▲' : '▼'}</small>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ))}
      <p className="muted"><small>
        Excluded from learning: {d.noMood} impressions with no mood, {d.notDeliverable} for stores that do not deliver to the visitor’s PIN, {d.unknownStore} for stores no longer in the catalog.
        Outcome weights, K and the clamp are design constants (see docs/RECOMMENDATION_ENGINE.md §6).
      </small></p>
    </section>
  );
}
