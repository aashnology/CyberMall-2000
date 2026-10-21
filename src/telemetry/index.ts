import { createDispatcher } from './dispatcher';

export const telemetry = createDispatcher(window.localStorage, crypto.randomUUID());
export const track = telemetry.track;
