import { FLOORS } from '../data/types';
import { useMallStore, type Panel } from '../state/mallStore';
import { audio, useAudioState } from '../audio/instance';

export function TopBar({ totals }: { readonly totals: { readonly all: number; readonly delivering: number; readonly notDelivering: number; readonly hidden: number } }): React.JSX.Element {
  const s = useMallStore();
  const snd = useAudioState();
  const open = (p: Panel, sfx: 'click' | 'bloop' = 'click') => (): void => { audio.play(sfx); s.openPanel(p); };
  const floor = FLOORS[s.floorId];
  const hourLabel = `${String(Math.floor(s.hour)).padStart(2, '0')}:${String(Math.floor((s.hour % 1) * 60)).padStart(2, '0')}`;
  return (
    <header className="topbar">
      <div className="brand">CyberMall <b>2000</b></div>
      <div className="chip" title="Deliveries are filtered for this PIN">
        <span>PIN <strong>{s.pincode}</strong></span>
        <button type="button" className="link" onClick={s.clearPincode}>Change</button>
      </div>
      <label className="check">
        <input type="checkbox" checked={s.onlyDeliverable} onChange={(e) => s.setOnlyDeliverable(e.target.checked)} />
        Only stores that deliver to me
      </label>
      <div className="floor-label">Floor {floor.id} · {floor.name}
        {s.floorId !== 6 && <small>{totals.delivering} deliver · {totals.notDelivering} don’t{s.onlyDeliverable && totals.hidden > 0 ? ` · ${totals.hidden} hidden` : ''}</small>}
      </div>
      <nav className="actions" aria-label="Mall tools">
        <button type="button" onClick={open('directory', 'bloop')}>Directory <kbd>L</kbd></button>
        <button type="button" onClick={open('map')}>Map <kbd>M</kbd></button>
        <button type="button" onClick={open('elevator')}>Elevator</button>
        <button type="button" onClick={open('avatar')}>Avatar</button>
        <button type="button" onClick={open('analytics')}>Analytics</button>
        <button type="button" aria-pressed={!snd.muted} disabled={!snd.supported} title={snd.supported ? 'Mute or unmute mall sound' : 'This browser has no Web Audio'}
          onClick={() => { const nowMuted = audio.toggleMute(); if (!nowMuted) { void audio.start(); audio.play('click'); } }}>
          Sound: {snd.muted || !snd.supported ? 'off' : 'on'}
        </button>
      </nav>
      <div className="clock">
        <label>Time {hourLabel}
          <input type="range" min={0} max={23.99} step={0.25} value={s.hour} onChange={(e) => s.setHour(Number(e.target.value))} aria-label="Time of day" />
        </label>
        <button type="button" className={s.autoClock ? 'on' : ''} onClick={() => s.setAutoClock(!s.autoClock)}>{s.autoClock ? 'Live clock' : 'Use my clock'}</button>
      </div>
    </header>
  );
}
