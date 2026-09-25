import { DiBag, type BuilderWithCollectionContribution, type ModuleOptions } from 'di-bag';

const clockKey = Symbol('clock');
const clock = DiBag.createToken(clockKey).forService<{ now(): number }>();
const toolsKey = Symbol('tools');
const tools = DiBag.createToken(toolsKey).forCollectionOf<string>();
const label = 'feature';
const options: ModuleOptions = { moduleLabel: label };
const deferredOptions: ModuleOptions = options;

const feature = DiBag.createBuilder()
  .withServices({ name: () => 'Ada' })
  .withTokenService(clock, () => ({ now: () => 1 }))
  .withServiceAlias({ aliasKey: 'now', targetServiceKey: clock })
  .withCollectionContribution({ collectionToken: tools, provider: () => 'search' })
  .withReplacedService('name', () => 'Grace')
  .buildModule({ exportedServiceKeys: ['name', clock], moduleLabel: label });

export const deferred = DiBag.createBuilder()
  .withServices({ value: () => 1 })
  .buildModule(['value'], deferredOptions);

const builder = DiBag.createBuilder().withInstalledModules([feature]);
builder.verifyGraphAtCompileTime() satisfies void;
export const app = builder.buildContainer();
export const extracted: BuilderWithCollectionContribution<any, any> = builder.contribute;
