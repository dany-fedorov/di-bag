import { DiBag } from '../../../src';

export const databaseKey = Symbol('database');
export const database = DiBag.token(databaseKey).of<{ read(): number }>();
const privateKey = Symbol('private');
const privateToken = DiBag.token(privateKey).of<{ id: number }>();
export const feature = DiBag.createBuilder().withTokenService(privateToken, () => ({ id: 1 })).withServices({ handler: DiBag.fromFunction([database, privateToken], (db, privateValue) => ({ run: () => db.read(), id: privateValue.id })) }).buildModule({ exportedServiceKeys: ['handler'] });
export const publicFeature = DiBag.createBuilder().withTokenService(database, () => ({ read: () => 1, rich: true as const })).withServices({ handler: DiBag.fromFunction([database], db => ({ run: () => db.read() })) }).buildModule({ exportedServiceKeys: [database, 'handler'] });
