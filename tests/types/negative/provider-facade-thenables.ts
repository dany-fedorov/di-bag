import { DiBag } from '../../../src';

class QueryBuilder {
  then(onFulfilled: (rows: number[]) => void) { onFulfilled([]); }
}

// diagnostic: factory output is a structural thenable
DiBag.providerWithDisposal({ provider: () => new QueryBuilder(), disposeService: () => {} });
// diagnostic: factory output is a structural thenable
DiBag.createBuilder().withServices({ owned: DiBag.providerWithDisposal({ provider: () => new QueryBuilder(), disposeService: () => {} }) });
// diagnostic: factory output is a structural thenable
DiBag.providerWithDisposal<() => QueryBuilder>({ provider: () => new QueryBuilder(), disposeService: () => {} });

const unionFactory = Math.random() ? () => 1 : () => new QueryBuilder();
// diagnostic: factory output is a structural thenable
DiBag.providerWithDisposal({ provider: unionFactory, disposeService: () => {} });
// diagnostic: factory output is a structural thenable
DiBag.providerWithDisposal({ provider: (): QueryBuilder | undefined => undefined, disposeService: () => {} });

const uninspected = DiBag.createProvider(() => new QueryBuilder(), { factoryReturnKind: 'uninspected' });
const mixed = Math.random() ? uninspected : () => new QueryBuilder();
// diagnostic: factory output is a structural thenable
DiBag.providerWithDisposal({ provider: mixed, disposeService: () => {} });

// diagnostic: factory output is a structural thenable
DiBag.providerWithLifetime({ provider: () => new QueryBuilder(), lifetime: 'scoped:one-per-container' });
// diagnostic: factory output is a structural thenable
DiBag.providerWithRegistrationMetadata({ provider: () => new QueryBuilder(), registrationMetadata: {} });
const exposedAcquisitionOptions = { provider: () => new QueryBuilder(), describeAcquisition: () => ({}), callbackReceives: 'exposed-service' as const };
// diagnostic: factory output is a structural thenable
DiBag.providerWithAcquisitionMetadata(exposedAcquisitionOptions);
// diagnostic: factory output is a structural thenable
DiBag.providerWithAcquisitionMetadata({ provider: () => new QueryBuilder(), describeAcquisition: () => ({}), callbackReceives: 'fulfilled-value' });
// diagnostic: factory output is a structural thenable
DiBag.providerWithTransformedService({ provider: () => new QueryBuilder(), transformService: (_value: QueryBuilder) => 1, callbackReceives: 'exposed-service' });
const fulfilledTransformOptions = { provider: () => new QueryBuilder(), transformService: (_value: number[]) => 1, callbackReceives: 'fulfilled-value' as const };
// diagnostic: factory output is a structural thenable
DiBag.providerWithTransformedService(fulfilledTransformOptions);

// diagnostic: factory output is a structural thenable
DiBag.providerWithDisposal({ provider: DiBag.createProvider(() => new QueryBuilder()), disposeService: () => {} });
// diagnostic: factory output is a structural thenable
DiBag.createBuilder().withServices({ owned: DiBag.providerWithDisposal({ provider: DiBag.createProvider(() => new QueryBuilder()), disposeService: () => {} }) });
