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
  service: DiBag.withLifetime(({ config }: { config: Config }) => config.value, 'root'),
}).buildModule({ exportedServiceKeys: ['service'] })
  .withRenamedRequirement({ currentRequirementKey: 'config', newRequirementKey: 'strictConfig' });
DiBag.createBuilder().withInstalledModules([strict])
  .withServices({ strictConfig: DiBag.withLifetime((): Config => ({ value: 1 }), 'root') })
  .buildContainer();
