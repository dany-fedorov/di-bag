import { DiBag, type Bag, type Module, type ModuleProvides, type ModuleRequires } from '../../../src';
import { feature } from '../modules/feature';
// diagnostic: not assignable
const annotated: Module<ModuleProvides<typeof feature>, ModuleRequires<typeof feature>> = feature;
// diagnostic: not assignable
const fewer: Module<{ handler: { run(): number } }, {}> = feature;
// diagnostic: missing
const fake: typeof feature = {};
// diagnostic: nominal
DiBag.begin().install({ ...feature });
const builder = DiBag.begin().install(feature).add({ logger: () => ({ log(_message: string) {} }) });
const plain = DiBag.begin().add({
  service: () => ({ read() { return 1; }, extra() { return true; } }),
  handler: () => ({ run() { return 1; } }), promised: async () => 7,
  logger: () => ({ log(_message: string) {} }),
});
// diagnostic: not assignable
const erasedBuilder: typeof plain = builder;
// diagnostic: not assignable
const erasedBag: Bag<{ service: () => { read(): number; extra(): boolean }; handler: () => { run(): number }; promised: () => Promise<number>; logger: () => { log(message: string): void } }> = builder.end();
// diagnostic: a dependency has the wrong shape
// diagnostic-native-gap: last-token-string
builder.replace('service', () => ({ read() { return 2; } }));
// diagnostic: not assignable
builder.end().fork(['service'], { service: () => ({ read() { return 2; } }) });
const open = DiBag.module().add({ service: () => 1, hidden: ({ missing }: { missing: number }) => missing });
const publicOnly = DiBag.module().add({ service: () => 1 });
// diagnostic: not assignable
const erasedOpen: typeof publicOnly = open;
const noNeeds = DiBag.module().add({ a: () => 1, b: () => 2 }).exports(['a', 'b']);
// diagnostic: not assignable
const fewerProvides: Module<{ a: number }, {}> = noNeeds;
const needs = DiBag.module().add({ value: ({ x, y }: { x: number; y: string }) => [x, y] }).exports(['value']);
type NeedsConstraints = typeof needs extends Module<infer _P, infer _R, infer C> ? C : never;
// diagnostic: not assignable
const fewerRequires: Module<ModuleProvides<typeof needs>, { x: number }, NeedsConstraints> = needs;
void [annotated, fewer, fake, erasedBuilder, erasedBag, erasedOpen];
