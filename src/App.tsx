import { useEffect, useMemo } from 'react';
import { audio } from './audio/instance';
import { CATALOG } from './data/catalog';
import { buildFloor6 } from './data/floor6';
import { buildDirectory } from './engine/pincode';
import { eligiblePromos } from './engine/banners';
import { DEFAULT_CONCOURSE, layoutFloor } from './spatial/concourse';
import { useMallStore } from './state/mallStore';
import { PincodeGate } from './ui/PincodeGate';
import { TopBar } from './ui/TopBar';
import { MallCanvas } from './ui/MallCanvas';
import { Directory } from './ui/Directory';
import { MiniMap } from './ui/MiniMap';
import { Elevator } from './ui/Elevator';
import { AvatarEditor } from './ui/AvatarEditor';
import { Floor6Panel } from './ui/Floor6Panel';
import { StoreModal } from './ui/StoreModal';
import { PhotoboothModal } from './photobooth/PhotoboothModal';
import { AnalyticsDashboard } from './components/analytics/AnalyticsDashboard';

export function App(): React.JSX.Element {
  const pincode = useMallStore((s) => s.pincode);
  const onlyDeliverable = useMallStore((s) => s.onlyDeliverable);
  const floorId = useMallStore((s) => s.floorId);
  const panel = useMallStore((s) => s.panel);

  const directory = useMemo(() => buildDirectory(CATALOG, { pincode, onlyDeliverable }), [pincode, onlyDeliverable]);
  const floor6 = useMemo(() => buildFloor6(pincode), [pincode]);
  const entries = floorId === 6 ? floor6.entries : directory.byFloor[floorId];
  const layout = useMemo(() => layoutFloor(entries.length, DEFAULT_CONCOURSE), [entries.length]);
  const banners = useMemo(() => eligiblePromos(directory), [directory]);

  // browsers only allow sound after a gesture: start on the first click or keypress
  useEffect(() => {
    if (!audio.isSupported) return undefined;
    const go = (): void => { void audio.start(); off(); };
    const off = (): void => { window.removeEventListener('pointerdown', go, true); window.removeEventListener('keydown', go, true); };
    window.addEventListener('pointerdown', go, true);
    window.addEventListener('keydown', go, true);
    return off;
  }, []);

  if (pincode === null) return <PincodeGate />;

  return (
    <div className="app">
      <TopBar totals={directory.totals} />
      <main className="stage">
        <MallCanvas layout={layout} entries={entries} floorId={floorId} pincode={pincode} banners={banners} />
        {entries.length === 0 && (
          <div className="empty-floor" role="status">
            <h2>Nothing here delivers to {pincode}</h2>
            <p>Every store on this floor is outside your delivery zone. Try another floor, or switch off “Only stores that deliver to me” to browse anyway.</p>
          </div>
        )}
        {floorId === 6 && <Floor6Panel model={floor6} pincode={pincode} />}
        {panel === 'directory' && <Directory directory={directory} floorEntries={entries} />}
        {panel === 'avatar' && <AvatarEditor />}
        {panel === 'map' && <MiniMap layout={layout} entries={entries} floorId={floorId} />}
        {panel === 'elevator' && <Elevator />}
        {panel === 'analytics' && <AnalyticsDashboard />}
        {panel === 'photobooth' && <PhotoboothModal />}
        <StoreModal />
      </main>
    </div>
  );
}
