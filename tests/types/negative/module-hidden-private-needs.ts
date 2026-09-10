import { DiBag } from '../../../src';
const module = DiBag.createBuilder().register({ hidden: ({ external }: { external: number }) => external }).buildModule([]);
// diagnostic: required service registrations are missing
DiBag.createBuilder().installModule(module).build();
// diagnostic: provided service does not satisfy its consumer dependency
DiBag.createBuilder().installModule(module).register({ external: () => 'wrong' });
const left = DiBag.createBuilder().register({ hidden: ({ external }: { external: { mode: true } }) => external }).buildModule([]);
const right = DiBag.createBuilder().register({ hidden: ({ external }: { external: { mode: false } }) => external }).buildModule([]);
// diagnostic: provided service does not satisfy its consumer dependency
DiBag.createBuilder().installModule(left).installModule(right).register({ external: () => ({ mode: true as const }) });
const open = DiBag.createBuilder().register({
  service: () => ({ read() { return 1; }, extra() { return true; } }),
  hidden: ({ service }: { service: { extra(): boolean } }) => service.extra(),
});
// diagnostic: provided service does not satisfy its consumer dependency
open.replace('service', () => ({ read() { return 2; } }));
