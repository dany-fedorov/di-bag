import { DiBag } from '../../../src';

export const databaseKey = Symbol('database');
export const database = DiBag.createToken(databaseKey).forService<{ read(): number }>();
const privateKey = Symbol('private');
const privateToken = DiBag.createToken(privateKey).forService<{ id: number }>();
export const feature = DiBag.createBuilder().withTokenService(privateToken, () => ({ id: 1 })).withServices({ handler: DiBag.createProviderFromFunction({ dependencies: [database, privateToken], factoryFunction: (db, privateValue) => ({ run: () => db.read(), id: privateValue.id }) }) }).buildModule({ exportedServiceKeys: ['handler'] });
export const publicFeature = DiBag.createBuilder().withTokenService(database, () => ({ read: () => 1, rich: true as const })).withServices({ handler: DiBag.createProviderFromFunction({ dependencies: [database], factoryFunction: db => ({ run: () => db.read() }) }) }).buildModule({ exportedServiceKeys: [database, 'handler'] });
