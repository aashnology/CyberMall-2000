import { useState } from 'react';
import { useMallStore } from '../state/mallStore';
import type { PincodeParseFailure } from '../engine/pincode';
import { track } from '../analytics/track';
import { audio } from '../audio/instance';

export const PINCODE_MESSAGES: Readonly<Record<PincodeParseFailure, string>> = {
  empty: 'Enter your 6-digit PIN code to step inside.',
  incomplete: 'A PIN code has exactly 6 digits.',
  'too-long': 'That is more than 6 digits. A PIN code has exactly 6.',
  'non-numeric': 'PIN codes contain digits only.',
  'invalid-leading-digit': 'Indian PIN codes never start with 0.',
};

export function PincodeGate(): React.JSX.Element {
  const setPincode = useMallStore((s) => s.setPincode);
  const [raw, setRaw] = useState('');
  const [error, setError] = useState<string | null>(null);

  const submit = (e: React.FormEvent): void => {
    e.preventDefault();
    const r = setPincode(raw);
    setError(r.ok ? null : PINCODE_MESSAGES[r.reason]);
    if (r.ok) { audio.play('click'); track('PINCODE_SUBMITTED', null); }
  };

  return (
    <div className="gate" role="dialog" aria-modal="true" aria-labelledby="gate-title">
      <form className="gate-card" onSubmit={submit} noValidate>
        <p className="eyebrow">CyberMall 2000</p>
        <h1 id="gate-title">Welcome to your new neighbourhood.</h1>
        <p className="lede">Discover what genuinely delivers to your doorstep in your new neighbourhood.</p>
        <label htmlFor="pin">Your PIN code</label>
        <input
          id="pin" inputMode="numeric" autoComplete="postal-code" autoFocus maxLength={9}
          value={raw} onChange={(e) => { setRaw(e.target.value); setError(null); }}
          aria-invalid={error !== null} aria-describedby={error !== null ? 'pin-error' : undefined}
        />
        {error !== null && <p id="pin-error" className="gate-error" role="alert">{error}</p>}
        <button type="submit">Enter the mall</button>
        <p className="fine">Every store is checked against this PIN. Stores that cannot reach you are clearly marked.</p>
      </form>
    </div>
  );
}
