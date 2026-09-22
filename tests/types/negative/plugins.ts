import { DiBag } from '../../../src';
import type { ProviderOutput } from '../../../src';
import type { ProviderBase } from '../../../src/provider';

declare const unknownPlugin: unknown;
const valid = (value: unknown): value is { run(): number } => typeof value === 'object' && value !== null;
// diagnostic: not assignable
DiBag.fromPlugin([], unknownPlugin, { acquisitionMode: 'auto', validate: valid });
// diagnostic: Property 'acquisitionMode' is missing
DiBag.fromPlugin([], unknownPlugin, { validate: valid });
// diagnostic: not assignable
DiBag.fromPlugin([], unknownPlugin, { acquisitionMode: 'raw', validate: (value: unknown): boolean => typeof value === 'object' });
// diagnostic: not assignable
DiBag.fromPlugin([], unknownPlugin, { acquisitionMode: 'raw', validate: function(this: { id: number }, value: unknown): value is { run(): number } { return this.id > 0 && typeof value === 'object'; } });
const key = Symbol('number'); const number = DiBag.token(key).of<number>();
declare const broad: readonly [typeof number, ...typeof number[]];
// diagnostic: finite tuple
DiBag.fromPlugin(broad, unknownPlugin, { acquisitionMode: 'raw', validate: valid });
const requiredPlugin = DiBag.fromPlugin([number], unknownPlugin, { acquisitionMode: 'raw', validate: valid });
// diagnostic: required service registrations are missing
DiBag.createBuilder().withServices({ requiredPlugin }).buildContainer();
const rootPlugin = DiBag.withLifetime(requiredPlugin, 'root');
// diagnostic: root lifetime cannot capture scoped dependency
DiBag.createBuilder().withTokenService(number, () => 1).withServices({ rootPlugin }).buildContainer();
const raw = DiBag.fromPlugin([], unknownPlugin, { acquisitionMode: 'raw', validate: valid });
const native = DiBag.fromPlugin([], unknownPlugin, { acquisitionMode: 'nativePromise', validate: valid });
// diagnostic: No overload matches
DiBag.withDisposal(raw, (value: Promise<{ run(): number }>) => { void value; });
// diagnostic: No overload matches
DiBag.withDisposal(native, (value: Promise<{ run(): number }>) => { void value; });
const privateFeature = DiBag.createBuilder().withTokenService(number, () => 1).withServices({ privatePlugin: requiredPlugin }).buildModule({ exportedServiceKeys: ['privatePlugin'] });
// diagnostic: not assignable
DiBag.createBuilder().withInstalledModules([privateFeature]).buildContainer().resolve(number);
declare const erased: ProviderBase;
declare const erasedOutput: ProviderOutput<typeof erased>;
// diagnostic: not assignable
const claimed: { run(): number } = erasedOutput;
