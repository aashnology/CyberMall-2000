/**
 * Renders a listenable demo of the spatial audio engine to a 16-bit WAV (raw engine output, not normalised).
 *   npx tsx scripts/renderAudioDemo.ts out.wav
 * 0–8 s mall bed · 8–16 s crossfade to Cafes floor · 16–24 s crossfade to Theatre & OTT floor, with UI sounds.
 */
import { writeFileSync } from 'node:fs';
import * as wa from 'node-web-audio-api';
import { SpatialAudio } from '../src/audio/spatialAudio';

const SR = 44100, SECONDS = 24;
async function main(): Promise<void> {
  const ctx = new wa.OfflineAudioContext(1, SR * SECONDS, SR);
  const a = new SpatialAudio({ storage: null });
  a.attach(ctx as unknown as BaseAudioContext);
  a.scheduleUntil(SECONDS);
  const sfx: Array<[number, 'click' | 'bloop' | 'open' | 'chime' | 'bell']> = [[1.0, 'click'], [2.2, 'bloop'], [3.6, 'open'], [5.0, 'chime'], [6.6, 'bell'], [10, 'click'], [14.5, 'bell'], [18, 'bloop'], [21, 'chime']];
  for (const [t, s] of sfx) a.play(s, t);
  const jobs = [[8, 8], [16, 6]] as const;
  const waits = jobs.map(([t, floor]) => ctx.suspend(t).then(() => { a.setListener({ floorId: floor, nearest: null }); return ctx.resume(); }));
  const buf = await ctx.startRendering();
  await Promise.all(waits);
  const d = new Float32Array(buf.getChannelData(0));
  const pcm = Buffer.alloc(44 + d.length * 2);
  pcm.write('RIFF', 0); pcm.writeUInt32LE(36 + d.length * 2, 4); pcm.write('WAVEfmt ', 8);
  pcm.writeUInt32LE(16, 16); pcm.writeUInt16LE(1, 20); pcm.writeUInt16LE(1, 22); pcm.writeUInt32LE(SR, 24);
  pcm.writeUInt32LE(SR * 2, 28); pcm.writeUInt16LE(2, 32); pcm.writeUInt16LE(16, 34); pcm.write('data', 36); pcm.writeUInt32LE(d.length * 2, 40);
  let peak = 0;
  for (let i = 0; i < d.length; i += 1) { const v = Math.max(-1, Math.min(1, d[i] as number)); peak = Math.max(peak, Math.abs(v)); pcm.writeInt16LE(Math.round(v * 32767), 44 + i * 2); }
  writeFileSync(process.argv[2] ?? '/tmp/demo.wav', pcm);
  writeFileSync('/tmp/demo.txt', `peak ${peak.toFixed(3)} bytes ${pcm.length}`);
}
main().then(() => process.exit(0), (e) => { writeFileSync('/tmp/demo.txt', `ERROR ${String(e)}`); process.exit(1); });
