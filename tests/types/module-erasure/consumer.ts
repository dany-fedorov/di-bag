import { DiBag, type ModuleExportedServices, type ModuleRequiredServices, type TokenKey } from '../../../src';
import { feature, tokenService } from './feature';
import type { Assert, Equal } from '../assert';

export type Exported = Assert<Equal<keyof ModuleExportedServices<typeof feature>, 'service' | 'passthrough' | TokenKey<typeof tokenService>>>;
export type Required = Assert<Equal<ModuleRequiredServices<typeof feature>, Readonly<{ external: string }>>>;

export const host = DiBag.createBuilder().installModule(feature).register({ external: () => 'x' }).build();
const service = host.resolve('service');
export type Service = Assert<Equal<typeof service, { read: (key: string) => number }>>;
export const id: number = host.resolve(tokenService).id;
export const count: number = host.resolve('passthrough')();

// Replacing an export stays checked against the private consumer's needs.
export const replaced = DiBag.createBuilder().installModule(feature).register({ external: () => 'x' })
  .replace('service', DiBag.withLifetime(() => ({ read: (_key: string) => 2 }), 'root')).build();

// A host root through the exported transient reaches `external`, which is a root here: accepted.
export const rootHost = DiBag.createBuilder().installModule(feature).register({
  external: DiBag.withLifetime(() => 'x', 'root'),
  api: DiBag.withLifetime(({ passthrough }: { passthrough: () => number }) => passthrough(), 'root'),
}).build();

// Renaming keeps the carrier obligation attached to the new name.
export const renamedHost = DiBag.createBuilder().installModule(feature.renameExport('passthrough', 'through')).register({
  external: DiBag.withLifetime(() => 'x', 'root'),
  api: DiBag.withLifetime(({ through }: { through: () => number }) => through(), 'root'),
}).build();
