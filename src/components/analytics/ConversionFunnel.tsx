import { useEffect, useRef, useState } from 'react';
import { Bar, BarChart, Cell, LabelList, Tooltip, XAxis, YAxis } from 'recharts';
import type { FunnelRow } from '../../analytics/metrics';
import { fmtInt, fmtPct } from './format';

const SHADES = ['#58111A', '#6E1A28', '#8E2638', '#B04A5A', '#C28D39'] as const;

function useWidth(): [React.RefObject<HTMLDivElement | null>, number] {
  const ref = useRef<HTMLDivElement>(null);
  const [w, setW] = useState(640);
  useEffect(() => {
    const el = ref.current;
    if (el === null || typeof ResizeObserver === 'undefined') return undefined;
    const ro = new ResizeObserver(() => setW(Math.max(320, Math.floor(el.getBoundingClientRect().width))));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return [ref, w];
}

export function ConversionFunnel({ rows }: { readonly rows: readonly FunnelRow[] }): React.JSX.Element {
  const [ref, width] = useWidth();
  const data = rows.map((r) => ({ label: r.stage.label, count: r.count }));
  const anyData = rows.some((r) => r.count > 0);
  return (
    <section className="an-card" aria-labelledby="funnel-title">
      <h3 id="funnel-title">Conversion funnel</h3>
      <p className="muted">Each bar counts distinct (session × store) journeys that reached that stage and every stage before it.</p>
      <div ref={ref} className="funnel-chart">
        {anyData ? (
          <BarChart width={width} height={250} data={data} layout="vertical" margin={{ top: 4, right: 56, bottom: 4, left: 8 }} accessibilityLayer={false}>
            <XAxis type="number" hide domain={[0, 'dataMax']} />
            <YAxis type="category" dataKey="label" width={140} tick={{ fontSize: 12, fill: '#2B1E1A' }} axisLine={false} tickLine={false} />
            <Tooltip cursor={{ fill: 'rgba(197,160,89,.15)' }} formatter={(v) => [fmtInt(Number(v)), 'Journeys']} />
            <Bar dataKey="count" radius={[0, 6, 6, 0]} isAnimationActive={false}>
              {data.map((d, i) => <Cell key={d.label} fill={SHADES[i % SHADES.length] as string} />)}
              <LabelList dataKey="count" position="right" fontSize={12} />
            </Bar>
          </BarChart>
        ) : <p className="empty">No journeys recorded yet. Walk the mall, hover stores and open a few to fill the funnel.</p>}
      </div>
      <table className="an-table">
        <caption className="sr-only">Funnel stages with conversion and drop-off</caption>
        <thead><tr><th scope="col">Stage</th><th scope="col">Journeys</th><th scope="col">Conversion from previous</th><th scope="col">Drop-off from previous</th><th scope="col">From top</th></tr></thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.stage.id}>
              <th scope="row">{r.stage.label}{r.skippedPrior > 0 && <small title="Reached this stage without completing every earlier one (for example a click without a 3 s dwell). Not counted."> · {r.skippedPrior} skipped earlier stage</small>}</th>
              <td>{fmtInt(r.count)}</td><td>{fmtPct(r.conversionFromPrev)}</td><td className={r.dropOffFromPrev !== null && r.dropOffFromPrev > 0.5 ? 'warn' : ''}>{fmtPct(r.dropOffFromPrev)}</td><td>{fmtPct(r.conversionFromTop)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}
