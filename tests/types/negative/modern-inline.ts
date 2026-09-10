import { DiBag } from '../../../src';

const providers = {
  service: () => ({ read() { return Number(1); }, extra() { return true; } }),
  promised: async () => 7,
};
const root = DiBag.createBuilder().register(providers).build();

// diagnostic: not assignable
root.fork(['service', 'promised'], {
  service: () => ({ read() { return 3; }, extra() { return true; } }),
  promised: async ({service}: {service: {richer(): number}}) => service.richer(),
});

// diagnostic: not assignable
DiBag.withMetadata(() => 1, { dynamic: { mode: 'direct', describe: (value: string) => ({ length: value.length }) } });
// diagnostic: not assignable
DiBag.withMetadata(() => 1, { dynamic: { mode: 'direct', describe: function (this: { missing: true }) { return { value: this.missing }; } } });
