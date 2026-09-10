import { DiBag, type LifecycleEvent, type ObserverFailure } from '../../../src';
// diagnostic: onError
DiBag.withConfiguration({ observers: [{ onEvent(event) {} }] });
// diagnostic: onEvent
DiBag.withConfiguration({ observers: [{ onError(failure) {} }] });
// diagnostic: not assignable
DiBag.withConfiguration({ observers: [{ onEvent: 1, onError(failure) {} }] });
// diagnostic: not assignable
DiBag.withConfiguration({ observers: [{ onEvent(event) {}, onError: null }] });
// diagnostic: not assignable
DiBag.withConfiguration({ observers: [{ onEvent(this: { owner: string }, event: LifecycleEvent) {}, onError(failure) {} }] });
// diagnostic: not assignable
DiBag.withConfiguration({ observers: [{ onEvent(event) {}, onError(this: { owner: string }, failure: ObserverFailure) {} }] });
// diagnostic: not assignable
DiBag.withConfiguration({ observers: [{ onEvent(event: { kind: 'scope-opened' }) {}, onError(failure) {} }] });
declare const event: LifecycleEvent;
if (event.kind === 'scope-opened') {
  // diagnostic: does not exist
  event.acquisitionId;
}
if (event.kind === 'acquisition-ready') {
  // diagnostic: does not exist
  event.error;
  // diagnostic: does not exist
  event.registrationMetadata.team;
  const frame = event.acquisitionMetadata[0];
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
