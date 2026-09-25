import { DiBag, type ModuleRequiredServices } from '../../src';
import type { Assert, Equal } from './assert';
type Config = { value: number };
export const renamed = DiBag.createBuilder().withServices({
  service: ({ config }: { config: Config }) => config.value,
}).buildModule({ exportedServiceKeys: ['service'] })
  .withRenamedRequirement({ currentRequirementKey: 'config', newRequirementKey: 'featureConfig' });
export type Requirement = Assert<Equal<ModuleRequiredServices<typeof renamed>, Readonly<{ featureConfig: Config }>>>;
export const rerouted = renamed.withRenamedRequirement({ currentRequirementKey: 'featureConfig', newRequirementKey: 'appConfig' });
export const host = DiBag.createBuilder().withInstalledModules([rerouted])
  .withServices({ appConfig: (): Config => ({ value: 1 }) }).buildContainer();
export const result: number = host.resolve('service');
export const strict = DiBag.createBuilder().withServices({
  service: DiBag.providerWithLifetime({ provider: ({ config }: { config: Config }) => config.value, lifetime: 'singleton:one-per-container-tree' }),
}).buildModule({ exportedServiceKeys: ['service'] })
  .withRenamedRequirement({ currentRequirementKey: 'config', newRequirementKey: 'strictConfig' });
DiBag.createBuilder().withInstalledModules([strict])
  .withServices({ strictConfig: DiBag.providerWithLifetime({ provider: (): Config => ({ value: 1 }), lifetime: 'singleton:one-per-container-tree' }) })
  .buildContainer();
