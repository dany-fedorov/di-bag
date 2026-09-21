import { DiBag } from 'di-bag';
import type { LifecycleEvent, Presence } from 'di-bag';

const clockKey = Symbol('clock');
const clock = DiBag.token(clockKey).of<{ now(): number }>();
const bag = DiBag.createBuilder().register(clock, () => ({ now: () => 42 })).register({ value: () => 1 }).build();

export const sameKey = clock.symbol === clockKey;
export const overrides = { [clock.symbol]: () => ({ now: () => 0 }) };
export const label = bag.inspect('value').bindingLabel;
const { bindingLabel: valueLabel, bindingId } = bag.inspect('value');
const { label: plainLabel } = { label: 'mine' };
export const names = [valueLabel, bindingId, plainLabel];
export const owned = bag.inspectGraph().bindings.map(binding => binding.owned);

export const found: Presence<number> = { isPresent: true, value: 1 };
export const missing: Presence<number> = { 'isPresent': false };
export const unrelated = { present: true, label: 'not a library object', key: 'k' };

export function observe(event: LifecycleEvent): symbol | string {
  if (event.kind === 'container-opened') return event.containerId;
  switch (event.kind) {
    case 'container-closed': return event.containerId;
    case 'acquisition-ready': return event.bindingLabel;
    default: return 'scope-opened';
  }
}
