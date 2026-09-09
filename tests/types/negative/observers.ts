import { DiBag, type LifecycleEvent, type ObserverFailure } from '../../../src';
// diagnostic: onError
DiBag.observe({ onEvent(event) {} });
// diagnostic: onEvent
DiBag.observe({ onError(failure) {} });
// diagnostic: not assignable
DiBag.observe({ onEvent: 1, onError(failure) {} });
// diagnostic: not assignable
DiBag.observe({ onEvent(event) {}, onError: null });
// diagnostic: not assignable
DiBag.observe({ onEvent(this: { owner: string }, event: LifecycleEvent) {}, onError(failure) {} });
// diagnostic: not assignable
DiBag.observe({ onEvent(event) {}, onError(this: { owner: string }, failure: ObserverFailure) {} });
// diagnostic: not assignable
DiBag.observe({ onEvent(event: { kind: 'scope-opened' }) {}, onError(failure) {} });
declare const event: LifecycleEvent;
if (event.kind === 'scope-opened') {
  // diagnostic: does not exist
  event.acquisitionId;
}
if (event.kind === 'acquisition-ready') {
  // diagnostic: does not exist
  event.error;
  // diagnostic: does not exist
  event.metadata.team;
  const frame = event.frames[0];
  if (frame?.present) {
    // diagnostic: unknown
    frame.value.owner;
  }
}
if (event.kind === 'cleanup-completed') {
  // diagnostic: not assignable
  const outcome: 'completed' = event.outcome;
  // diagnostic: read-only
  event.outcome = 'success';
}
// diagnostic: does not exist
event.value;
