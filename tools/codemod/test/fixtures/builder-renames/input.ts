import { DiBag, type BuilderContribute, type ModuleOptions } from 'di-bag';

const clockKey = Symbol('clock');
const clock = DiBag.token(clockKey).of<{ now(): number }>();
const toolsKey = Symbol('tools');
const tools = DiBag.token(toolsKey).of<string>();
const label = 'feature';
const options: ModuleOptions = { label };
const deferredOptions: ModuleOptions = options;

const feature = DiBag.createBuilder()
  .register({ name: () => 'Ada' })
  .register(clock, () => ({ now: () => 1 }))
  .alias('now', clock)
  .contribute(tools, () => 'search')
  .replace('name', () => 'Grace')
  .buildModule(['name', clock], { label });

export const deferred = DiBag.createBuilder()
  .register({ value: () => 1 })
  .buildModule(['value'], deferredOptions);

const builder = DiBag.createBuilder().installModule(feature);
builder.verifyGraph() satisfies void;
export const app = builder.build();
export const extracted: BuilderContribute<any, any> = builder.contribute;
