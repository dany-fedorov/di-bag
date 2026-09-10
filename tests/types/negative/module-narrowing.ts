import { DiBag, type Bag, type Module, type ModuleExportedServices, type ModuleRequiredServices } from '../../../src';
import { feature } from '../modules/feature';
// diagnostic: not assignable
const annotated: Module<ModuleExportedServices<typeof feature>, ModuleRequiredServices<typeof feature>> = feature;
// diagnostic: not assignable
const fewer: Module<{ handler: { run(): number } }, {}> = feature;
// diagnostic: missing
const fake: typeof feature = {};
// diagnostic: nominal
DiBag.createBuilder().installModule({ ...feature });
const builder = DiBag.createBuilder().installModule(feature).register({ logger: () => ({ log(_message: string) {} }) });
const plain = DiBag.createBuilder().register({
  service: () => ({ read() { return 1; }, extra() { return true; } }),
  handler: () => ({ run() { return 1; } }), promised: async () => 7,
  logger: () => ({ log(_message: string) {} }),
});
// diagnostic: not assignable
const erasedBuilder: typeof plain = builder;
// diagnostic: not assignable
const erasedBag: Bag<{ service: () => { read(): number; extra(): boolean }; handler: () => { run(): number }; promised: () => Promise<number>; logger: () => { log(message: string): void } }> = builder.build();
// diagnostic: provided service does not satisfy its consumer dependency
builder.replace('service', () => ({ read() { return 2; } }));
// diagnostic: not assignable
builder.build().fork(['service'], { service: () => ({ read() { return 2; } }) });
const open = DiBag.createBuilder().register({ service: () => 1, hidden: ({ missing }: { missing: number }) => missing });
const publicOnly = DiBag.createBuilder().register({ service: () => 1 });
// diagnostic: not assignable
const erasedOpen: typeof publicOnly = open;
const noNeeds = DiBag.createBuilder().register({ a: () => 1, b: () => 2 }).buildModule(['a', 'b']);
// diagnostic: not assignable
const fewerProvides: Module<{ a: number }, {}> = noNeeds;
const needs = DiBag.createBuilder().register({ value: ({ x, y }: { x: number; y: string }) => [x, y] }).buildModule(['value']);
type NeedsConstraints = typeof needs extends Module<infer _P, infer _R, infer C> ? C : never;
// diagnostic: not assignable
const fewerRequires: Module<ModuleExportedServices<typeof needs>, { x: number }, NeedsConstraints> = needs;
void [annotated, fewer, fake, erasedBuilder, erasedBag, erasedOpen];
