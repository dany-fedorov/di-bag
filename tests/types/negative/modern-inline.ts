import { DiBag } from '../../../src';
import { fromValBox } from '../../../src/val-box';

const providers = {
  service: () => ({ read() { return Number(1); }, extra() { return true; } }),
  promised: async () => 7,
};
const root = DiBag.begin().add(providers).end();

// diagnostic: not assignable
root.fork(['service', 'promised'], {
  service: () => ({ read() { return 3; }, extra() { return true; } }),
  promised: async ({service}: {service: {richer(): number}}) => service.richer(),
});

// diagnostic: invalid val-box snapshot capability
fromValBox(() => ({ snapshot(required: string) {
  return { value: {present: true as const, value: required}, metadata: {present: false as const}, alias: null };
} }));

// diagnostic: invalid val-box snapshot capability
fromValBox(() => ({ snapshot(this: {missing: true}) {
  return { value: {present: true as const, value: 1}, metadata: {present: false as const}, alias: null };
} }));
