import { DiBag } from '../../../src';

export const databaseKey = Symbol('database');
export const database = DiBag.token(databaseKey).of<{ read(): number }>();
const privateKey = Symbol('private');
const privateToken = DiBag.token(privateKey).of<{ id: number }>();
export const feature = DiBag.module().bind(privateToken, () => ({ id: 1 }))
  .add({ handler: DiBag.fromTokens([database, privateToken], (db, privateValue) => ({ run: () => db.read(), id: privateValue.id })) })
  .exports(['handler']);
export const publicFeature = DiBag.module().bind(database, () => ({ read: () => 1, rich: true as const }))
  .add({ handler: DiBag.fromTokens([database], db => ({ run: () => db.read() })) }).exports([database, 'handler']);
