import { DiBag } from '../../../src';

const numbersKey = Symbol('numbers');
const numbers = DiBag.createToken(numbersKey).forCollectionOf<number>();
const scopedExternal = DiBag.providerWithLifetime({ provider: () => 1, lifetime: 'scoped:one-per-container' });

const strictOnly = DiBag.createBuilder()
  .withCollectionContribution({ collectionToken: numbers, provider: ({ external }: { external: number }) => external })
  .buildModule({ exportedServiceKeys: [] });
// diagnostic: root lifetime cannot capture scoped dependency: contribution -> external
DiBag.createBuilder().withInstalledModules([strictOnly])
  .withServices({ external: scopedExternal }).buildContainer();

const transientOnly = DiBag.createBuilder()
  .withCollectionContribution({ collectionToken: numbers, provider: DiBag.providerWithLifetime({
    provider: ({ external }: { external: number }) => external,
    lifetime: 'transient:one-per-resolve',
  }) })
  .buildModule({ exportedServiceKeys: [] });
const rootAll = DiBag.createProviderFromFunction({ dependencies: [numbers], factoryFunction: values => values.length });
// diagnostic: root lifetime cannot capture scoped dependency: rootAll -> external
DiBag.createBuilder().withInstalledModules([transientOnly])
  .withServices({ external: scopedExternal, rootAll }).buildContainer();

const renamedOnly = DiBag.createBuilder()
  .withCollectionContribution({ collectionToken: numbers, provider: ({ external }: { external: number }) => external })
  .buildModule({ exportedServiceKeys: [] })
  .withRenamedRequirement({ currentRequirementKey: 'external', newRequirementKey: 'featureExternal' });
// diagnostic: root lifetime cannot capture scoped dependency: contribution -> featureExternal
DiBag.createBuilder().withInstalledModules([renamedOnly])
  .withServices({ featureExternal: scopedExternal }).buildContainer();
