import { DiBag, type Module, type Provider } from '../../../src';
import type { NeedConstraint } from '../../../src/module-types';
import type { TokenDependencyContract } from '../../../src/token-types';
import type { TokenBase } from '../../../src/tokens';
const key = Symbol('database'); const database = DiBag.token(key).of<{ read(): number }>();
const conflict = DiBag.token(key).of<{ write(): void }>();
const feature = DiBag.createModuleBuilder().register({ handler: DiBag.fromFunction([database], db => db.read()) }).buildModule(['handler']);
// diagnostic: required service registrations are missing
DiBag.createBuilder().installModule(feature).register({ ordinary: () => 1 }).build();
// diagnostic: not assignable
DiBag.createBuilder().installModule(feature).register(conflict, () => ({ read: () => 1, write() {} }));
const publicFeature = DiBag.createModuleBuilder().register(database, () => ({ read: () => 1 })).register({ handler: DiBag.fromFunction([database], db => db.read()) }).buildModule([database, 'handler']);
// diagnostic: not assignable
const erased: Module<{ [key]: { read: () => number }; handler: number }, {}> = publicFeature;
declare const opaque: Module<{}, {}, NeedConstraint>;
// diagnostic: not assignable
DiBag.createBuilder().installModule(opaque);
declare const opaqueD: Module<{ value: number }, {}, never, { value: Provider<() => number, {}, readonly [], import('../../../src/token-types').OpaqueGraph> }>;
// diagnostic: incompatible
DiBag.createBuilder().installModule(opaqueD);
const privateFeature = DiBag.createModuleBuilder().register(database, () => ({ read: () => 1 })).register({ handler: DiBag.fromFunction([database], db => db.read()) }).buildModule(['handler']);
// diagnostic: not assignable
DiBag.createBuilder().installModule(privateFeature).build().resolve(database);
// diagnostic: not assignable
DiBag.createModuleBuilder().register(database, () => ({ read: () => 1 })).buildModule([conflict]);
// diagnostic: finite tuple
DiBag.createModuleBuilder().register(database, () => ({ read: () => 1 })).buildModule([database] as typeof database[]);
// diagnostic: not assignable
DiBag.createBuilder().installModule(publicFeature).replace(database, () => ({ write() {} }));
// diagnostic: required service registrations are missing
DiBag.createBuilder().installModule(feature.renameExport('handler', 'renamed')).build();
