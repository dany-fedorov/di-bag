import { DiBag, type FactoryReturnKind } from '../../../src';

const provider = DiBag.createProvider(() => Promise.resolve(1), { factoryReturnKind: 'native-promise' });
declare const mode: 'fulfilled-value' | 'exposed-service';
// diagnostic: not assignable
DiBag.providerWithTransformedService({ provider, callbackReceives: mode, transformService: (value: Promise<number>) => value });

declare const kind: Extract<FactoryReturnKind, 'native-promise' | 'sync-value'>;
// diagnostic: not assignable
DiBag.providerWithTransformedService({ provider, callbackReceives: 'exposed-service', transformService: value => value, transformReturnKind: kind });
