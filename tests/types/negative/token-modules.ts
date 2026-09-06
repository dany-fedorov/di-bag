import { DiBag, type Module, type Provider } from '../../../src';
import type { NeedConstraint } from '../../../src/module-types';
import type { TokenGraph } from '../../../src/token-types';
import type { TokenBase } from '../../../src/tokens';
const key = Symbol('database'); const database = DiBag.token(key).of<{ read(): number }>();
const conflict = DiBag.token(key).of<{ write(): void }>();
const feature = DiBag.module().add({ handler: DiBag.fromTokens([database], db => db.read()) }).exports(['handler']);
// diagnostic: missing factories
DiBag.begin().install(feature).add({ ordinary: () => 1 }).end();
// diagnostic: not assignable
DiBag.begin().install(feature).bind(conflict, () => ({ read: () => 1, write() {} }));
const publicFeature = DiBag.module().bind(database, () => ({ read: () => 1 })).add({ handler: DiBag.fromTokens([database], db => db.read()) }).exports([database, 'handler']);
// diagnostic: not assignable
const erased: Module<{ [key]: { read: () => number }; handler: number }, {}> = publicFeature;
declare const opaque: Module<{}, {}, NeedConstraint>;
// diagnostic: not assignable
DiBag.begin().install(opaque);
declare const opaqueD: Module<{ value: number }, {}, never, { value: Provider<() => number, {}, readonly [], import('../../../src/token-types').OpaqueGraph> }>;
// diagnostic: incompatible
DiBag.begin().install(opaqueD);
const privateFeature = DiBag.module().bind(database, () => ({ read: () => 1 })).add({ handler: DiBag.fromTokens([database], db => db.read()) }).exports(['handler']);
// diagnostic: not assignable
DiBag.begin().install(privateFeature).end().resolve(database);
// diagnostic: not assignable
DiBag.module().bind(database, () => ({ read: () => 1 })).exports([conflict]);
// diagnostic: finite tuple
DiBag.module().bind(database, () => ({ read: () => 1 })).exports([database] as typeof database[]);
// diagnostic: not assignable
DiBag.begin().install(publicFeature).replace(database, () => ({ write() {} }));
// diagnostic: missing factories
DiBag.begin().install(feature.rename('handler', 'renamed')).end();
