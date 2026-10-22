import { FLOORS } from '../data/catalog';

interface Props { floor: number; onSelect: (floor: number) => void; onClose: () => void }

/** Bronze lift panel: category plate beside a numbered button; the active floor glows amber. */
export function ElevatorPanel({ floor, onSelect, onClose }: Props) {
  return (
    <nav className="panel" aria-label="Elevator">
      <h3 className="paneltitle">SELECT FLOOR</h3>
      {[...FLOORS].reverse().map((f) => (
        <div key={f.floor} className={`row ${f.floor === floor ? 'active' : ''}`}>
          <button className="btnnum" aria-label={`Floor ${f.floor}: ${f.label}`} onClick={() => onSelect(f.floor)}>{f.floor}</button>
          <button className="plate" onClick={() => onSelect(f.floor)}>{f.label}<small>{f.wings}</small></button>
        </div>
      ))}
      <button className="btn" onClick={onClose}>Close</button>
    </nav>
  );
}
