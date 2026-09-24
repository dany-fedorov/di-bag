import { DiBag } from '../../../src';

const root = DiBag.createBuilder().withServices({
  singleton: () => ({ value: 1 }),
  scoped: DiBag.providerWithLifetime({ provider: () => ({ value: 2 }), lifetime: 'scoped:one-per-container' }),
  transient: DiBag.providerWithLifetime({ provider: () => ({ value: 3 }), lifetime: 'transient:one-per-resolve' }),
}).buildContainer();

root.createChildContainer(
  ['singleton'],
  // diagnostic: createChildContainer cannot replace singleton service: singleton; mark it scoped:one-per-container or use createIndependentContainer
  { singleton: () => ({ value: 4 }) },
);

const singletonKey = Symbol('singleton');
const singletonToken = DiBag.createToken(singletonKey).forService<{ value: number }>();
const tokenRoot = DiBag.createBuilder()
  .withTokenService(singletonToken, () => ({ value: 1 }))
  .buildContainer();
tokenRoot.createChildContainer(
  [singletonToken],
  // diagnostic: createChildContainer cannot replace singleton service
  { [singletonToken.symbol]: () => ({ value: 2 }) },
);

// diagnostic: root lifetime cannot capture scoped dependency: consumer -> scoped
DiBag.createBuilder().withServices({
  scoped: DiBag.providerWithLifetime({ provider: () => 1, lifetime: 'scoped:one-per-container' }),
  consumer: ({ scoped }: { scoped: number }) => scoped,
}).buildContainer();

// diagnostic: root lifetime cannot capture scoped dependency: aliasConsumer -> scopedAlias
DiBag.createBuilder()
  .withServices({ scopedAliasTarget: DiBag.providerWithLifetime({ provider: () => 1, lifetime: 'scoped:one-per-container' }) })
  .withServiceAlias({ aliasKey: 'scopedAlias', targetServiceKey: 'scopedAliasTarget' })
  .withServices({ aliasConsumer: ({ scopedAlias }: { scopedAlias: number }) => scopedAlias })
  .buildContainer();

const throughModule = DiBag.createBuilder().withServices({
  api: ({ external }: { external: number }) => external,
}).buildModule({ exportedServiceKeys: ['api'], moduleLabel: 'feature' })
  .withRenamedRequirement({ currentRequirementKey: 'external', newRequirementKey: 'renamedExternal' });
// diagnostic: root lifetime cannot capture scoped dependency: api -> renamedExternal
DiBag.createBuilder().withInstalledModules([throughModule]).withServices({
  renamedExternal: DiBag.providerWithLifetime({ provider: () => 1, lifetime: 'scoped:one-per-container' }),
}).buildContainer();

// These remain valid and ensure admission is specific to child containers.
root.createChildContainer(
  ['scoped', 'transient'],
  { scoped: () => ({ value: 4 }), transient: () => ({ value: 5 }) },
);
root.createIndependentContainer(
  ['singleton'],
  { singleton: () => ({ value: 6 }) },
);

const rejectedOptions: import('../../../src').CreateChildContainerOptions<
  { singleton: () => { value: number } }, readonly [], never, readonly ['singleton'],
  { singleton: () => { value: number } }
> = {
  replacedServiceKeys: ['singleton'],
  // diagnostic: createChildContainer cannot replace singleton service
  replacementProviders: { singleton: () => ({ value: 2 }) },
};
void rejectedOptions;
