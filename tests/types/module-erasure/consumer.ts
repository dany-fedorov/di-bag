import { DiBag, type ModuleExportedServices, type ModuleRequiredServices, type TokenKey } from '../../../src';
import { feature, tokenService } from './feature';
import type { Assert, Equal } from '../assert';

// The private root `privateHelper` needs `clock`, so every host supplies it as a root.
const clock = DiBag.providerWithLifetime({ provider: () => () => 0, lifetime: 'singleton:one-per-container-tree' });

export type Exported = Assert<Equal<keyof ModuleExportedServices<typeof feature>, 'service' | 'passthrough' | TokenKey<typeof tokenService>>>;
export type Required = Assert<Equal<ModuleRequiredServices<typeof feature>, Readonly<{ external: string; clock: () => number }>>>;

export const host = DiBag.createBuilder().withInstalledModules([feature]).withServices({ external: () => 'x', clock }).buildContainer();
const service = host.resolve('service');
export type Service = Assert<Equal<typeof service, { read: (key: string) => number }>>;
export const id: number = host.resolve(tokenService).id;
export const count: number = host.resolve('passthrough')();

// Replacing an export stays checked against the private consumer's needs.
export const replaced = DiBag.createBuilder().withInstalledModules([feature]).withServices({ external: () => 'x', clock })
  .withReplacedService('service', DiBag.providerWithLifetime({ provider: () => ({ read: (_key: string) => 2 }), lifetime: 'singleton:one-per-container-tree' })).buildContainer();

// A host root through the exported transient reaches `external`, which is a root here: accepted.
export const rootHost = DiBag.createBuilder().withInstalledModules([feature]).withServices({
  external: DiBag.providerWithLifetime({ provider: () => 'x', lifetime: 'singleton:one-per-container-tree' }),
  clock,
  api: DiBag.providerWithLifetime({ provider: ({ passthrough }: { passthrough: () => number }) => passthrough(), lifetime: 'singleton:one-per-container-tree' }),
}).buildContainer();

// Renaming keeps the carrier obligation attached to the new name.
export const renamedHost = DiBag.createBuilder().withInstalledModules([feature.withRenamedExport({ currentExportKey: 'passthrough', newExportKey: 'through' })]).withServices({
  external: DiBag.providerWithLifetime({ provider: () => 'x', lifetime: 'singleton:one-per-container-tree' }),
  clock,
  api: DiBag.providerWithLifetime({ provider: ({ through }: { through: () => number }) => through(), lifetime: 'singleton:one-per-container-tree' }),
}).buildContainer();
