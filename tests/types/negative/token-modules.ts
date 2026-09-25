import { DiBag, type Module, type Provider } from '../../../src';
import type { NeedConstraint } from '../../../src/module-types';
import type { TokenDependencyContract } from '../../../src/token-types';
import type { TokenBase } from '../../../src/tokens';
const key = Symbol('database'); const database = DiBag.createToken(key).forService<{ read(): number }>();
const conflict = DiBag.createToken(key).forService<{ write(): void }>();
const feature = DiBag.createBuilder().withServices({ handler: DiBag.createProviderFromFunction({ dependencies: [database], factoryFunction: db => db.read() }) }).buildModule({ exportedServiceKeys: ['handler'] });
// diagnostic: required services are missing
DiBag.createBuilder().withInstalledModules([feature]).withServices({ ordinary: () => 1 }).buildContainer();
// diagnostic: not assignable
DiBag.createBuilder().withInstalledModules([feature]).withTokenService(conflict, () => ({ read: () => 1, write() {} }));
const publicFeature = DiBag.createBuilder().withTokenService(database, () => ({ read: () => 1 })).withServices({ handler: DiBag.createProviderFromFunction({ dependencies: [database], factoryFunction: db => db.read() }) }).buildModule({ exportedServiceKeys: [database, 'handler'] });
// diagnostic: not assignable
const erased: Module<{ [key]: { read: () => number }; handler: number }, {}> = publicFeature;
declare const opaque: Module<{}, {}, NeedConstraint>;
// diagnostic: not assignable
DiBag.createBuilder().withInstalledModules([opaque]);
declare const opaqueD: Module<{ value: number }, {}, never, { value: Provider<() => number, {}, readonly [], import('../../../src/token-types').OpaqueGraph> }>;
// diagnostic: incompatible
DiBag.createBuilder().withInstalledModules([opaqueD]);
const privateFeature = DiBag.createBuilder().withTokenService(database, () => ({ read: () => 1 })).withServices({ handler: DiBag.createProviderFromFunction({ dependencies: [database], factoryFunction: db => db.read() }) }).buildModule({ exportedServiceKeys: ['handler'] });
// diagnostic: not assignable
DiBag.createBuilder().withInstalledModules([privateFeature]).buildContainer().resolve(database);
// diagnostic: not assignable
DiBag.createBuilder().withTokenService(database, () => ({ read: () => 1 })).buildModule({ exportedServiceKeys: [conflict] });
// diagnostic: finite tuple
DiBag.createBuilder().withTokenService(database, () => ({ read: () => 1 })).buildModule({ exportedServiceKeys: [database] as typeof database[] });
// diagnostic: not assignable
DiBag.createBuilder().withInstalledModules([publicFeature]).withReplacedService(database, () => ({ write() {} }));
// diagnostic: required services are missing
DiBag.createBuilder().withInstalledModules([feature.withRenamedExport({ currentExportKey: 'handler', newExportKey: 'renamed' })]).buildContainer();
