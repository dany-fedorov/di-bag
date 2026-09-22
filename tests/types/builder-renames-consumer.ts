import { buildModuleMethod, physicalClock, physicalFeature, physicalLogging, physicalTools,
  withCollectionContributionMethod, withInstalledModulesMethod, withReplacedServiceMethod,
  withServiceAliasMethod, withServicesMethod, withTokenServiceMethod } from './builder-renames';
import type { Assert, Equal } from './assert';
const named = withServicesMethod({ named: () => 1 }).buildContainer().resolve('named');
const clock = withTokenServiceMethod({ token: physicalClock, provider: () => ({ now: () => 1 }) }).buildContainer().resolve(physicalClock);
const alias = withServiceAliasMethod({ aliasKey: 'copy', targetServiceKey: 'target' }).buildContainer().resolve('copy');
const tools = withCollectionContributionMethod({ collectionToken: physicalTools, provider: () => 'search' }).buildContainer().resolveCollection(physicalTools);
const replacedFast = withReplacedServiceMethod({ serviceKey: 'base', provider: () => 2 }).buildContainer().resolve('base');
const replacedGeneral = withReplacedServiceMethod({ serviceKey: 'derived', provider: ({ base }: { base: number }) => base * 2 }).buildContainer().resolve('derived');
const physicalModule = buildModuleMethod({ exportedServiceKeys: ['moduleValue'] });
const installed = withInstalledModulesMethod([physicalFeature, physicalLogging, physicalModule]).buildContainer();
const installedService = installed.resolve('service');
const installedModuleValue = installed.resolve('moduleValue');
export type Exact = [
  Assert<Equal<typeof named, number>>, Assert<Equal<typeof clock, { now(): number }>>,
  Assert<Equal<typeof alias, number>>, Assert<Equal<typeof tools, readonly string[]>>,
  Assert<Equal<typeof replacedFast, number>>, Assert<Equal<typeof replacedGeneral, number>>,
  Assert<Equal<typeof installedService, { read(): string }>>, Assert<Equal<typeof installedModuleValue, boolean>>,
];
