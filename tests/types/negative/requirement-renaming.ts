import { DiBag } from '../../../src';
type Config = { value: number };
const module = DiBag.createBuilder().withServices({
  shown: () => 1,
  service: ({ config, region }: { config: Config; region: string }) => config.value + region.length,
}).buildModule({ exportedServiceKeys: ['shown', 'service'] });

module.withRenamedRequirement({
  // diagnostic: withRenamedRequirement requires an existing singleton string-literal requirement
  currentRequirementKey: 'missing',
  newRequirementKey: 'other',
});
module.withRenamedRequirement({
  currentRequirementKey: 'config',
  // diagnostic: withRenamedRequirement requires a noncolliding singleton string-literal name
  newRequirementKey: 'region',
});
module.withRenamedRequirement({
  currentRequirementKey: 'config',
  // diagnostic: withRenamedRequirement requires a noncolliding singleton string-literal name
  newRequirementKey: 'shown',
});
declare const widened: string;
module.withRenamedRequirement({
  // diagnostic: withRenamedRequirement requires an existing singleton string-literal requirement
  currentRequirementKey: widened,
  newRequirementKey: 'other',
});
const renamed = module.withRenamedRequirement({ currentRequirementKey: 'config', newRequirementKey: 'featureConfig' });
// diagnostic: provided service does not satisfy its consumer dependency; see https://dany-fedorov.github.io/di-bag/agent/errors.html#wrong-shape
DiBag.createBuilder().withInstalledModules([renamed]).withServices({
  featureConfig: () => ({ value: 'wrong' }),
  region: () => 'eu',
}).buildContainer();

const configKey = Symbol('config');
const token = DiBag.createToken(configKey).forService<Config>();
module.withRenamedRequirement({
  // diagnostic: not assignable
  currentRequirementKey: token,
  newRequirementKey: 'other',
});
module.withRenamedRequirement({
  currentRequirementKey: 'config',
  // diagnostic: not assignable
  newRequirementKey: Symbol('other'),
});
const strict = DiBag.createBuilder().withServices({
  service: DiBag.withLifetime(({ config }: { config: Config }) => config.value, 'root'),
}).buildModule({ exportedServiceKeys: ['service'] })
  .withRenamedRequirement({ currentRequirementKey: 'config', newRequirementKey: 'strictConfig' });
// diagnostic: root lifetime cannot capture scoped dependency
DiBag.createBuilder().withInstalledModules([strict])
  .withServices({ strictConfig: (): Config => ({ value: 1 }) }).buildContainer();
