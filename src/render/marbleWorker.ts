/** Renders the marble floor off the main thread. */
import { renderMarbleFloor } from './marbleFloor';
import type { ConcourseSpec } from '../spatial/concourse';

export interface MarbleRequest {
  readonly key: string;
  readonly spec: ConcourseSpec;
  readonly radius: number;
  readonly size: number;
  readonly pxPerUnit: number;
}
export interface MarbleResponse { readonly key: string; readonly size: number; readonly buffer: ArrayBuffer }

interface WorkerScope {
  onmessage: ((e: MessageEvent<MarbleRequest>) => void) | null;
  postMessage(msg: MarbleResponse, transfer: Transferable[]): void;
}
const scope = self as unknown as WorkerScope;
scope.onmessage = (e) => {
  const { key, spec, radius, size, pxPerUnit } = e.data;
  const img = renderMarbleFloor({ width: size, height: size, pxPerUnit, spec, radius });
  scope.postMessage({ key, size, buffer: img.data.buffer as ArrayBuffer }, [img.data.buffer as ArrayBuffer]);
};
