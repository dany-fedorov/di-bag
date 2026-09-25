import { DiBag } from '../../../src';
const provider = DiBag.createProvider(async () => 1);
// diagnostic: lifetime requires an individually known policy literal
DiBag.providerWithLifetime({ provider, lifetime: 'root' });
// diagnostic: lifetime requires an individually known policy literal
DiBag.providerWithLifetime({ provider, lifetime: 'scoped' });
// diagnostic: lifetime requires an individually known policy literal
DiBag.providerWithLifetime({ provider, lifetime: 'transient' });
DiBag.providerWithLifetime({ provider, lifetime: 'scoped:one-per-container',
  // diagnostic: providerWithLifetime allowsScopedDependencies requires singleton lifetime and a boolean value
  allowsScopedDependencies: false });
DiBag.providerWithLifetime({ provider, lifetime: 'transient:one-per-resolve',
  // diagnostic: providerWithLifetime allowsScopedDependencies requires singleton lifetime and a boolean value
  allowsScopedDependencies: false });
DiBag.providerWithLifetime({ provider, lifetime: 'scoped:one-per-container',
  // diagnostic: Type 'undefined' is not assignable
  allowsScopedDependencies: undefined });
DiBag.providerWithLifetime({ provider, lifetime: 'singleton:one-per-container-tree',
  // diagnostic: Type 'string' is not assignable to type 'boolean'
  allowsScopedDependencies: 'yes' });
DiBag.providerWithLifetime({ provider, lifetime: 'singleton:one-per-container-tree',
  // diagnostic: providerWithLifetime allowsScopedDependencies requires singleton lifetime and a boolean value
  extra: true });
// diagnostic: Type '"later"' is not assignable to type '"exposed-service"'
// diagnostic-native-gap: last-provider-acquisition-mode
DiBag.providerWithAcquisitionMetadata({ provider, callbackReceives: 'later', describeAcquisition: value => ({ value }) });
// diagnostic: acquisition metadata must be a synchronous object record
DiBag.providerWithAcquisitionMetadata({ provider, callbackReceives: 'fulfilled-value', describeAcquisition: async value => ({ value }) });
// diagnostic: Type 'string' is not assignable to type 'never'
// diagnostic-native-gap: last-provider-transform-fulfilled-mode
DiBag.providerWithTransformedService({ provider, callbackReceives: 'fulfilled-value', transformService: value => value, transformReturnKind: 'sync-value' });
// diagnostic: native-promise factory return kind requires a Promise output
DiBag.providerWithTransformedService({ provider, callbackReceives: 'exposed-service', transformService: () => 1, transformReturnKind: 'native-promise' });
// diagnostic: sync-value output must not be a Promise or thenable
DiBag.providerWithTransformedService({ provider, callbackReceives: 'exposed-service', transformService: () => Promise.resolve(1), transformReturnKind: 'sync-value' });
// diagnostic: factory output is a structural thenable
DiBag.providerWithTransformedService({ provider, callbackReceives: 'exposed-service', transformService: () => ({ then() {} }) });
// diagnostic: Property 'transformReturnKind' is missing
DiBag.providerWithTransformedService<typeof provider, () => Promise<number>, 'native-promise'>({ provider, callbackReceives: 'exposed-service', transformService: () => Promise.resolve(1) });
// diagnostic: duplicate metadata keys
DiBag.providerWithRegistrationMetadata({ provider: DiBag.providerWithRegistrationMetadata({ provider, registrationMetadata: { owner: 'one' } }), registrationMetadata: { owner: 'two' } });
const dependent = DiBag.providerWithTransformedService({ provider: DiBag.createProvider(({ value }: { value: number }) => value), callbackReceives: 'exposed-service', transformService: value => value + 1 });
// diagnostic: not assignable to parameter of type 'never'
DiBag.createBuilder().withServices({ value: () => 1 }).withReplacedService('value', dependent);
