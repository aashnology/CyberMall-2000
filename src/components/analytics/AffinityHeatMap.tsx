import { type HeatMap, MIN_RELIABLE_SESSIONS } from '../../analytics/metrics';
import { fmtPct } from './format';

const cellStyle = (pct: number | null): React.CSSProperties =>
  pct === null ? {} : { background: `rgba(88,17,26,${(0.06 + 0.84 * pct).toFixed(3)})`, color: pct > 0.45 ? '#FDFBF7' : '#2B1E1A' };

export function AffinityHeatMap({ map }: { readonly map: HeatMap }): React.JSX.Element {
  return (
    <section className="an-card" aria-labelledby="heat-title">
      <h3 id="heat-title">Aesthetic affinity · PIN cluster × mood</h3>
      <p className="muted">Share of sessions from each PIN cluster that picked each mood at least once. Clusters under {MIN_RELIABLE_SESSIONS} sessions are marked and should not be over-read.</p>
      {map.rows.length === 0 ? <p className="empty">No sessions yet. Pick a mood in the Directory to start filling this grid.</p> : (
        <div className="heat-scroll">
          <table className="an-table heat">
            <caption className="sr-only">Percentage of sessions per PIN cluster that engaged with each mood</caption>
            <thead><tr><th scope="col">PIN cluster</th><th scope="col">Sessions</th>{map.moods.map((m) => <th scope="col" key={m.id}>{m.label}</th>)}</tr></thead>
            <tbody>
              {map.rows.map((r) => (
                <tr key={r.cluster.id}>
                  <th scope="row">{r.cluster.label}</th>
                  <td>{r.sessions}{r.lowSample && <small title={`Fewer than ${MIN_RELIABLE_SESSIONS} sessions`}> · low n</small>}</td>
                  {r.cells.map((c) => (
                    <td key={c.moodId} style={cellStyle(c.pct)} aria-label={`${fmtPct(c.pct)} of ${r.sessions} sessions from ${r.cluster.label} engaged with ${map.moods.find((m) => m.id === c.moodId)?.label ?? c.moodId}`}>
                      {fmtPct(c.pct, 0)}<small> {c.engaged}/{r.sessions}</small>
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
