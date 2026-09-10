import { DiBag } from '../../../src';

export const databaseKey = Symbol('database');
export const database = DiBag.token(databaseKey).of<{ read(): number }>();
const privateKey = Symbol('private');
const privateToken = DiBag.token(privateKey).of<{ id: number }>();
export const feature = DiBag.createModuleBuilder().register(privateToken, () => ({ id: 1 })).register({ handler: DiBag.fromFunction([database, privateToken], (db, privateValue) => ({ run: () => db.read(), id: privateValue.id })) }).buildModule(['handler']);
export const publicFeature = DiBag.createModuleBuilder().register(database, () => ({ read: () => 1, rich: true as const })).register({ handler: DiBag.fromFunction([database], db => ({ run: () => db.read() })) }).buildModule([database, 'handler']);
