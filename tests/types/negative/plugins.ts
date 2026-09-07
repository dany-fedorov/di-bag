import { DiBag } from '../../../src';
import type { ProviderOutput } from '../../../src';
import type { ProviderBase } from '../../../src/provider';

declare const unknownPlugin: unknown;
const valid = (value: unknown): value is { run(): number } => typeof value === 'object' && value !== null;
// diagnostic: not assignable
DiBag.fromPlugin([], unknownPlugin, { acquisition: 'auto', validate: valid });
// diagnostic: not assignable
DiBag.fromPlugin([], unknownPlugin, { validate: valid });
// diagnostic: not assignable
DiBag.fromPlugin([], unknownPlugin, { acquisition: 'raw', validate: (value: unknown): boolean => typeof value === 'object' });
// diagnostic: not assignable
DiBag.fromPlugin([], unknownPlugin, { acquisition: 'raw', validate: function(this: { id: number }, value: unknown): value is { run(): number } { return this.id > 0 && typeof value === 'object'; } });
const key = Symbol('number'); const number = DiBag.token(key).of<number>();
declare const broad: readonly [typeof number, ...typeof number[]];
// diagnostic: finite tuple
DiBag.fromPlugin(broad, unknownPlugin, { acquisition: 'raw', validate: valid });
const requiredPlugin = DiBag.fromPlugin([number], unknownPlugin, { acquisition: 'raw', validate: valid });
// diagnostic: missing factories
DiBag.begin().add({ requiredPlugin }).end();
const rootPlugin = DiBag.withLifetime(requiredPlugin, 'root');
// diagnostic: root lifetime cannot capture scoped dependency
DiBag.begin().bind(number, () => 1).add({ rootPlugin }).end();
const raw = DiBag.fromPlugin([], unknownPlugin, { acquisition: 'raw', validate: valid });
const native = DiBag.fromPlugin([], unknownPlugin, { acquisition: 'native', validate: valid });
// diagnostic: No overload matches
DiBag.withDisposal(raw, (value: Promise<{ run(): number }>) => { void value; });
// diagnostic: No overload matches
DiBag.withDisposal(native, (value: Promise<{ run(): number }>) => { void value; });
const privateFeature = DiBag.module().bind(number, () => 1).add({ privatePlugin: requiredPlugin }).exports(['privatePlugin']);
// diagnostic: not assignable
DiBag.begin().install(privateFeature).end().resolve(number);
declare const erased: ProviderBase;
declare const erasedOutput: ProviderOutput<typeof erased>;
// diagnostic: not assignable
const claimed: { run(): number } = erasedOutput;
