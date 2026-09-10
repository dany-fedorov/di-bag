import { DiBag, type Provider, type TokenDependencyContract } from '../../../src';
import type { OpaqueGraph } from '../../../src/token-types';
import type { TokenBase } from '../../../src/tokens';

// diagnostic: provided service does not satisfy its consumer dependency
DiBag.createBuilder().register({ read: ({ value }: { value: number }) => value }).register({ value: () => 'wrong' });
// diagnostic: provided service does not satisfy its consumer dependency
DiBag.createBuilder().register({ value: () => 'wrong' }).register({ read: ({ value }: { value: number }) => value });
// diagnostic: provided service does not satisfy its consumer dependency
DiBag.createBuilder().register({ value: () => 1, read: ({ value }: { value: string }) => value });
// diagnostic: provided service does not satisfy its consumer dependency
DiBag.createBuilder().register({ value: () => 1, read: ({ value }: { value: number }) => value }).replace('value', () => 'wrong');
// diagnostic: provided service does not satisfy its consumer dependency
DiBag.createBuilder().register({ value: () => 1, read: ({ value }: { value: number }) => value }).replace('read', ({ value }: { value: string }) => value);

const key = Symbol('value');
const token = DiBag.token(key).of<number>();
const wider = DiBag.token(key).of<number | string>();
// diagnostic: incompatible or opaque
DiBag.createBuilder().register({ read: DiBag.fromFunction([wider], value => value) }).register(token, () => 1);
// diagnostic: incompatible or opaque
DiBag.createBuilder().register(token, () => 1).register({ read: DiBag.fromFunction([wider], value => value) });
// diagnostic: incompatible or opaque
DiBag.createBuilder().register(token, () => 1).register({ read: () => 1 }).replace('read', DiBag.fromFunction([wider], value => value));
// diagnostic: output is not assignable
DiBag.createBuilder().register(token, () => 1).replace(token, () => 'wrong');
// diagnostic: provided service does not satisfy its consumer dependency
DiBag.createBuilder().register({ value: () => 1 }).register(token, ({ value }: { value: string }) => value.length);
// diagnostic: required service registrations are missing
DiBag.createBuilder().register({ read: DiBag.fromFunction([token], value => value) }).build();

declare const opaque: Provider<() => number, {}, readonly [], OpaqueGraph>;
// diagnostic: incompatible or opaque
DiBag.createBuilder().register({ opaque });
declare const opaqueBound: Provider<() => number, {}, readonly [], TokenDependencyContract<readonly [], TokenBase>>;
// diagnostic: incompatible or opaque
DiBag.createBuilder().register({ opaqueBound });

const privateModule = DiBag.createModuleBuilder().register({ hidden: ({ external }: { external: number }) => external }).buildModule([]);
// diagnostic: provided service does not satisfy its consumer dependency
DiBag.createBuilder().installModule(privateModule).register({ external: () => 'wrong' });
// diagnostic: provided service does not satisfy its consumer dependency
DiBag.createBuilder().installModule(privateModule).register({ external: () => 1 }).replace('external', () => 'wrong');
// diagnostic: required service registrations are missing
DiBag.createBuilder().installModule(privateModule).build();

const privateToken = DiBag.createModuleBuilder().register({ hidden: DiBag.fromFunction([wider], value => value) }).buildModule([]);
// diagnostic: provided service does not satisfy its consumer dependency
DiBag.createBuilder().installModule(privateToken).register(token, () => 1);

// diagnostic: incompatible or opaque
DiBag.createBuilder().register({ read: ({ value }: { value: number }) => value }).register({ opaque, value: () => 'wrong' });
// diagnostic: provided service does not satisfy its consumer dependency
DiBag.createBuilder().register(token, () => 1).register({ local: () => 1,
  invalidNamed: ({ local }: { local: string }) => local.length,
  wrongToken: DiBag.fromFunction([wider], value => value) });
