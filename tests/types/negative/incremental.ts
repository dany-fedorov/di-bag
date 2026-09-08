import { DiBag, type Provider, type TokenGraph } from '../../../src';
import type { OpaqueGraph } from '../../../src/token-types';
import type { TokenBase } from '../../../src/tokens';

// diagnostic: a dependency has the wrong shape
DiBag.begin().add({ read: ({ value }: { value: number }) => value }).add({ value: () => 'wrong' });
// diagnostic: a dependency has the wrong shape
DiBag.begin().add({ value: () => 'wrong' }).add({ read: ({ value }: { value: number }) => value });
// diagnostic: a dependency has the wrong shape
DiBag.begin().add({ value: () => 1, read: ({ value }: { value: string }) => value });
// diagnostic: a dependency has the wrong shape
DiBag.begin().add({ value: () => 1, read: ({ value }: { value: number }) => value }).replace('value', () => 'wrong');
// diagnostic: a dependency has the wrong shape
DiBag.begin().add({ value: () => 1, read: ({ value }: { value: number }) => value }).replace('read', ({ value }: { value: string }) => value);

const key = Symbol('value');
const token = DiBag.token(key).of<number>();
const wider = DiBag.token(key).of<number | string>();
// diagnostic: incompatible or opaque
DiBag.begin().add({ read: DiBag.fromTokens([wider], value => value) }).bind(token, () => 1);
// diagnostic: incompatible or opaque
DiBag.begin().bind(token, () => 1).add({ read: DiBag.fromTokens([wider], value => value) });
// diagnostic: incompatible or opaque
DiBag.begin().bind(token, () => 1).add({ read: () => 1 }).replace('read', DiBag.fromTokens([wider], value => value));
// diagnostic: output is not assignable
DiBag.begin().bind(token, () => 1).replace(token, () => 'wrong');
// diagnostic: a dependency has the wrong shape
DiBag.begin().add({ value: () => 1 }).bind(token, ({ value }: { value: string }) => value.length);
// diagnostic: missing factories
DiBag.begin().add({ read: DiBag.fromTokens([token], value => value) }).end();

declare const opaque: Provider<() => number, {}, readonly [], OpaqueGraph>;
// diagnostic: incompatible or opaque
DiBag.begin().add({ opaque });
declare const opaqueBound: Provider<() => number, {}, readonly [], TokenGraph<readonly [], TokenBase>>;
// diagnostic: incompatible or opaque
DiBag.begin().add({ opaqueBound });

const privateModule = DiBag.module().add({ hidden: ({ external }: { external: number }) => external }).exports([]);
// diagnostic: a dependency has the wrong shape
DiBag.begin().install(privateModule).add({ external: () => 'wrong' });
// diagnostic: a dependency has the wrong shape
DiBag.begin().install(privateModule).add({ external: () => 1 }).replace('external', () => 'wrong');
// diagnostic: missing factories
DiBag.begin().install(privateModule).end();

const privateToken = DiBag.module().add({ hidden: DiBag.fromTokens([wider], value => value) }).exports([]);
// diagnostic: a dependency has the wrong shape
DiBag.begin().install(privateToken).bind(token, () => 1);

// diagnostic: incompatible or opaque
DiBag.begin().add({ read: ({ value }: { value: number }) => value }).add({ opaque, value: () => 'wrong' });
// diagnostic: a dependency has the wrong shape
DiBag.begin().bind(token, () => 1).add({ local: () => 1,
  invalidNamed: ({ local }: { local: string }) => local.length,
  wrongToken: DiBag.fromTokens([wider], value => value) });
