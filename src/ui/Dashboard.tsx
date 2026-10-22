import { useMemo } from 'react';
import { countBy, funnel, impressionsVsClicks, kpis } from '../telemetry/aggregate';
import { toCsv } from '../telemetry/csv';
import { telemetry } from '../telemetry';

const pct = (v: number): string => `${(v * 100).toFixed(1)}%`;

function Bars({ rows }: { rows: { label: string; value: number }[] }) {
  const max = Math.max(1, ...rows.map((r) => r.value));
  if (rows.length === 0) return <p className="muted">No data yet. Explore the mall to generate events.</p>;
  return <>{rows.map((r) => (
    <div className="bar" key={r.label}><span>{r.label}</span><i style={{ width: `${(r.value / max) * 100}%` }} /><b>{r.value}</b></div>
  ))}</>;
}

export function Dashboard({ onClose }: { onClose: () => void }) {
  const events = useMemo(() => telemetry.read(), []);
  const k = kpis(events);
  const download = () => {
    const url = URL.createObjectURL(new Blob([toCsv(events)], { type: 'text/csv' }));
    const a = document.createElement('a'); a.href = url; a.download = 'cybermall-events.csv'; a.click(); URL.revokeObjectURL(url);
  };
  return (
    <div className="modal" role="dialog" aria-label="Analytics dashboard">
      <div className="dash">
        <header><h2>Analytics</h2><span><button className="btn" onClick={download}>Export CSV</button> <button className="btn" onClick={onClose}>Close</button></span></header>
        <div className="kpis">
          {[['Total interactions', String(k.totalInteractions)], ['Unique mood sessions', String(k.uniqueMoodSessions)], ['Click-through rate', pct(k.ctr)], ['Mood-to-save', pct(k.moodToSave)]]
            .map(([l, v]) => <div className="kpi" key={l}><small>{l}</small><strong>{v}</strong></div>)}
        </div>
        <div className="grid">
          <section><h3>Mood engagement</h3><Bars rows={countBy(events, 'MOOD_SELECTED', 'moodId').map((r) => ({ label: r.key, value: r.count }))} /></section>
          <section><h3>Impressions vs clicks</h3><Bars rows={impressionsVsClicks(events).flatMap((r) => [{ label: `${r.category} impressions`, value: r.impressions }, { label: `${r.category} clicks`, value: r.clicks }])} /></section>
          <section><h3>Conversion funnel (sessions)</h3><Bars rows={funnel(events).map((f) => ({ label: f.stage, value: f.sessions }))} /></section>
          <section><h3>Pincode checks</h3><Bars rows={countBy(events, 'PINCODE_UPDATED', 'pincode').map((r) => ({ label: r.key, value: r.count }))} /></section>
        </div>
      </div>
    </div>
  );
}
