import { DiBag, type ModuleExportedServices, type ModuleRequiredServices, type TokenKey } from '../../../src';
import { feature, tokenService } from './feature';
import type { Assert, Equal } from '../assert';

// The private root `privateHelper` needs `clock`, so every host supplies it as a root.
const clock = DiBag.withLifetime(() => () => 0, 'root');

export type Exported = Assert<Equal<keyof ModuleExportedServices<typeof feature>, 'service' | 'passthrough' | TokenKey<typeof tokenService>>>;
export type Required = Assert<Equal<ModuleRequiredServices<typeof feature>, Readonly<{ external: string; clock: () => number }>>>;

export const host = DiBag.createBuilder().withInstalledModules([feature]).withServices({ external: () => 'x', clock }).buildContainer();
const service = host.resolve('service');
export type Service = Assert<Equal<typeof service, { read: (key: string) => number }>>;
export const id: number = host.resolve(tokenService).id;
export const count: number = host.resolve('passthrough')();

// Replacing an export stays checked against the private consumer's needs.
export const replaced = DiBag.createBuilder().withInstalledModules([feature]).withServices({ external: () => 'x', clock })
  .withReplacedService('service', DiBag.withLifetime(() => ({ read: (_key: string) => 2 }), 'root')).buildContainer();

// A host root through the exported transient reaches `external`, which is a root here: accepted.
export const rootHost = DiBag.createBuilder().withInstalledModules([feature]).withServices({
  external: DiBag.withLifetime(() => 'x', 'root'),
  clock,
  api: DiBag.withLifetime(({ passthrough }: { passthrough: () => number }) => passthrough(), 'root'),
}).buildContainer();

// Renaming keeps the carrier obligation attached to the new name.
export const renamedHost = DiBag.createBuilder().withInstalledModules([feature.renameExport('passthrough', 'through')]).withServices({
  external: DiBag.withLifetime(() => 'x', 'root'),
  clock,
  api: DiBag.withLifetime(({ through }: { through: () => number }) => through(), 'root'),
}).buildContainer();
