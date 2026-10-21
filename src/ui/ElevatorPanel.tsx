import { FLOORS } from '../data/catalog';

interface Props { floor: number; onSelect: (floor: number) => void }

/** Bronze panel: category plate beside a numbered button; the active floor glows amber. */
export function ElevatorPanel({ floor, onSelect }: Props) {
  return (
    <nav className="panel" aria-label="Elevator">
      {[...FLOORS].reverse().map((f) => (
        <div key={f.floor} className={`row ${f.floor === floor ? 'active' : ''}`}>
          <button className="btnnum" aria-label={`Floor ${f.floor}: ${f.label}`} onClick={() => onSelect(f.floor)}>{f.floor}</button>
          <button className="plate" onClick={() => onSelect(f.floor)}>{f.label}</button>
        </div>
      ))}
    </nav>
  );
}
