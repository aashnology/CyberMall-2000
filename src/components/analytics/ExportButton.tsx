import { useState } from 'react';
import { eventsToCsv, exportFilename, type TelemetryEvent } from '../../analytics/telemetry';
import { downloadTextFile } from '../../analytics/download';

export interface ExportButtonProps {
  readonly events: readonly TelemetryEvent[];
  /** Injectable for tests; defaults to a real browser download. */
  readonly onDownload?: (filename: string, csv: string) => void;
}

export function ExportButton({ events, onDownload = (n, c) => downloadTextFile(n, c) }: ExportButtonProps): React.JSX.Element {
  const [status, setStatus] = useState<string | null>(null);
  const empty = events.length === 0;
  return (
    <div className="export-row">
      <button type="button" className="export-btn" disabled={empty} title={empty ? 'No telemetry recorded yet' : undefined}
        onClick={() => { const name = exportFilename(); onDownload(name, eventsToCsv(events)); setStatus(`Exported ${events.length} ${events.length === 1 ? 'event' : 'events'} to ${name}`); }}>
        Export Telemetry (CSV)
      </button>
      <span role="status" className="muted">{empty ? 'Nothing to export yet.' : status ?? `${events.length} events on this device. The file never leaves it unless you share it.`}</span>
    </div>
  );
}
