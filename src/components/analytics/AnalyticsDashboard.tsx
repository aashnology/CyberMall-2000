import { useMemo } from 'react';
import { telemetry } from '../../analytics/instance';
import { useTelemetryEvents } from '../../analytics/track';
import { computeAffinity, computeFunnel, summarize } from '../../analytics/metrics';
import { MOODS } from '../../data/moods';
import { useMallStore } from '../../state/mallStore';
import { ConversionFunnel } from './ConversionFunnel';
import { AffinityHeatMap } from './AffinityHeatMap';
import { ExportButton } from './ExportButton';
import { fmtInt } from './format';

export function AnalyticsDashboard(): React.JSX.Element {
  const events = useTelemetryEvents();
  const close = useMallStore((s) => s.closePanel);
  const funnel = useMemo(() => computeFunnel(events), [events]);
  const heat = useMemo(() => computeAffinity(events, MOODS), [events]);
  const sum = useMemo(() => summarize(events), [events]);
  return (
    <div className="analytics-overlay" role="dialog" aria-modal="true" aria-label="Analytics dashboard">
      <div className="analytics">
        <header className="an-head">
          <div><p className="eyebrow">Executive analytics</p><h2>Neighbourhood engagement</h2></div>
          <button type="button" onClick={close} aria-label="Close analytics">✕</button>
        </header>
        <div className="kpis">
          <div><b>{fmtInt(sum.events)}</b><span>events logged</span></div>
          <div><b>{fmtInt(sum.sessions)}</b><span>sessions</span></div>
          <div><b>{fmtInt(sum.pincodes)}</b><span>distinct PINs</span></div>
        </div>
        <ConversionFunnel rows={funnel} />
        <AffinityHeatMap map={heat} />
        <ExportButton events={events} />
        <button type="button" className="link danger" disabled={events.length === 0}
          onClick={() => { if (window.confirm('Delete all telemetry stored on this device? This cannot be undone.')) telemetry.clear(); }}>Clear stored telemetry</button>
      </div>
    </div>
  );
}
