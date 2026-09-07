import { DiBag } from '../../../src';
const module = DiBag.module().add({ hidden: ({ external }: { external: number }) => external }).exports([]);
// diagnostic: missing factories
DiBag.begin().install(module).end();
// diagnostic: a dependency has the wrong shape
DiBag.begin().install(module).add({ external: () => 'wrong' });
const left = DiBag.module().add({ hidden: ({ external }: { external: { mode: true } }) => external }).exports([]);
const right = DiBag.module().add({ hidden: ({ external }: { external: { mode: false } }) => external }).exports([]);
// diagnostic: a dependency has the wrong shape
DiBag.begin().install(left).install(right).add({ external: () => ({ mode: true as const }) });
const open = DiBag.module().add({
  service: () => ({ read() { return 1; }, extra() { return true; } }),
  hidden: ({ service }: { service: { extra(): boolean } }) => service.extra(),
});
// diagnostic: a dependency has the wrong shape
// diagnostic-native-gap: last-token-string
open.replace('service', () => ({ read() { return 2; } }));
