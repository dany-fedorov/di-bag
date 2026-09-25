import { DiBag } from '../../../src';
const module = DiBag.createBuilder().withServices({ hidden: ({ external }: { external: number }) => external }).buildModule({ exportedServiceKeys: [] });
// diagnostic: required services are missing
DiBag.createBuilder().withInstalledModules([module]).buildContainer();
// diagnostic: provided service does not satisfy its consumer dependency
DiBag.createBuilder().withInstalledModules([module]).withServices({ external: () => 'wrong' });
const left = DiBag.createBuilder().withServices({ hidden: ({ external }: { external: { mode: true } }) => external }).buildModule({ exportedServiceKeys: [] });
const right = DiBag.createBuilder().withServices({ hidden: ({ external }: { external: { mode: false } }) => external }).buildModule({ exportedServiceKeys: [] });
// diagnostic: provided service does not satisfy its consumer dependency
DiBag.createBuilder().withInstalledModules([left]).withInstalledModules([right]).withServices({ external: () => ({ mode: true as const }) });
const open = DiBag.createBuilder().withServices({
  service: () => ({ read() { return 1; }, extra() { return true; } }),
  hidden: ({ service }: { service: { extra(): boolean } }) => service.extra(),
});
// diagnostic: provided service does not satisfy its consumer dependency
open.withReplacedService('service', () => ({ read() { return 2; } }));
