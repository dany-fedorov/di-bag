import { DiBag } from 'di-bag';
import type { LifecycleEvent, Presence } from 'di-bag';

const clockKey = Symbol('clock');
const clock = DiBag.token(clockKey).of<{ now(): number }>();
const bag = DiBag.createBuilder().register(clock, () => ({ now: () => 42 })).register({ value: () => 1 }).build();

export const sameKey = clock.key === clockKey;
export const overrides = { [clock.key]: () => ({ now: () => 0 }) };
export const label = bag.inspect('value').label;
const { label: valueLabel, bindingId } = bag.inspect('value');
const { label: plainLabel } = { label: 'mine' };
export const names = [valueLabel, bindingId, plainLabel];
export const owned = bag.inspectGraph().bindings.map(binding => binding.owned);

export const found: Presence<number> = { present: true, value: 1 };
export const missing: Presence<number> = { 'present': false };
export const unrelated = { present: true, label: 'not a library object', key: 'k' };

export function observe(event: LifecycleEvent): symbol | string {
  if (event.kind === 'scope-opened') return event.scopeId;
  switch (event.kind) {
    case 'scope-closed': return event.scopeId;
    case 'acquisition-ready': return event.label;
    default: return 'scope-opened';
  }
}
