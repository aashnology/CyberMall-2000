import { PRESETS, type TimeOfDay } from '../lighting/dayCycle';
import { earnedBadges, unlockedFilters, type ScreenFilter } from '../rewards/collectibles';
import { useMall } from '../store/useMall';

interface Props { onMap: () => void; onDashboard: () => void }

export function SettingsPanel({ onMap, onDashboard }: Props) {
  const { time, filter, collected, setTime, setFilter } = useMall();
  const badges = earnedBadges(collected);
  return (
    <div className="settings">
      <button className="chip" onClick={onMap}>Map (M)</button>
      <button className="chip" onClick={onDashboard}>Analytics</button>
      <select aria-label="Time of day" value={time} onChange={(e) => setTime(e.target.value as 'auto' | TimeOfDay)}>
        <option value="auto">Time: local clock</option>
        {(Object.keys(PRESETS) as TimeOfDay[]).map((t) => <option key={t} value={t}>{PRESETS[t].label}</option>)}
      </select>
      <select aria-label="Screen filter" value={filter} onChange={(e) => setFilter(e.target.value as ScreenFilter)}>
        {unlockedFilters(collected).map((f) => <option key={f} value={f}>{f === 'none' ? 'Filter: none' : `Filter: ${f}`}</option>)}
      </select>
      <small>{collected.length}/3 found{badges.length ? ` · ${badges.join(' · ')}` : ''}</small>
    </div>
  );
}
