import { DiBag } from 'di-bag';

const chosen = 'scoped:one-per-container' as const;
const singleton = DiBag.providerWithLifetime({
  provider: DiBag.providerWithTransformedService({
    provider: DiBag.providerWithAcquisitionMetadata({
      provider: DiBag.providerWithRegistrationMetadata({
        provider: DiBag.providerWithDisposal({ provider: () => 1, disposeService: () => {} }),
        registrationMetadata: { owner: 'graph' },
      }),
      callbackReceives: 'exposed-service',
      describeAcquisition: value => ({ value }),
    }),
    callbackReceives: 'exposed-service',
    transformService: value => value,
  }),
  lifetime: 'singleton:one-per-container-tree',
});
const scoped = DiBag.providerWithLifetime({ provider: () => 2, lifetime: 'scoped:one-per-container' });
const request = DiBag.providerWithLifetime({ provider: () => ({ id: 'request' }), lifetime: 'scoped:one-per-container' });
const transient = DiBag.providerWithTransformedService({
  provider: DiBag.providerWithLifetime({
    provider: DiBag.providerWithDisposal({ provider: () => 3, disposeService: () => {} }),
    lifetime: 'transient:one-per-resolve',
  }),
  callbackReceives: 'exposed-service',
  transformService: value => value,
});
const dynamic = DiBag.providerWithLifetime({ provider: () => 4, lifetime: chosen });
const reset = DiBag.providerWithLifetime({
  provider: DiBag.providerWithLifetime({ provider: () => 5, lifetime: 'singleton:one-per-container-tree' }),
  lifetime: 'scoped:one-per-container',
});
const shortRoot = DiBag.providerWithLifetime({ provider: () => 6, lifetime: 'root' as any });
const shortScoped = DiBag.providerWithLifetime({ provider: () => 7, lifetime: 'scoped' as any });
const shortTransient = DiBag.providerWithLifetime({ provider: () => 8, lifetime: 'transient' as any });
class DiBagApi { providerWithLifetime(_options: object) { return this; } }
class Provider { providerWithLifetime(_options: object) { return this; } }
const localProvider = new DiBagApi().providerWithLifetime({ provider: () => 9, lifetime: 'singleton:one-per-container-tree' }) as any;
const localObject = ({ providerWithDisposal() { return this; } }).providerWithDisposal() as any;

export const container = DiBag.createBuilder().withServices({ singleton, scoped, request, transient, dynamic, reset, shortRoot, shortScoped, shortTransient, localProvider, localObject }).buildContainer();
