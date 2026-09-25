import { DiBag, type Container, type Module, type ModuleExportedServices, type ModuleRequiredServices } from '../../../src';
import { feature } from '../modules/feature';
// diagnostic: not assignable
const annotated: Module<ModuleExportedServices<typeof feature>, ModuleRequiredServices<typeof feature>> = feature;
// diagnostic: not assignable
const fewer: Module<{ handler: { run(): number } }, {}> = feature;
// diagnostic: missing
const fake: typeof feature = {};
// diagnostic: withInstalledModules requires a finite tuple of genuine modules
DiBag.createBuilder().withInstalledModules([{ ...feature }]);
const builder = DiBag.createBuilder().withInstalledModules([feature]).withServices({ logger: () => ({ log(_message: string) {} }) });
const plain = DiBag.createBuilder().withServices({
  service: () => ({ read() { return 1; }, extra() { return true; } }),
  handler: () => ({ run() { return 1; } }), promised: async () => 7,
  logger: () => ({ log(_message: string) {} }),
});
// diagnostic: not assignable
const erasedBuilder: typeof plain = builder;
// diagnostic: not assignable
const erasedBag: Container<{ service: () => { read(): number; extra(): boolean }; handler: () => { run(): number }; promised: () => Promise<number>; logger: () => { log(message: string): void } }> = builder.buildContainer();
// diagnostic: provided service does not satisfy its consumer dependency
builder.withReplacedService('service', () => ({ read() { return 2; } }));
// diagnostic: not assignable
builder.buildContainer().createIndependentContainer(['service'], { service: () => ({ read() { return 2; } }) });
const open = DiBag.createBuilder().withServices({ service: () => 1, hidden: ({ missing }: { missing: number }) => missing });
const publicOnly = DiBag.createBuilder().withServices({ service: () => 1 });
// diagnostic: not assignable
const erasedOpen: typeof publicOnly = open;
const noNeeds = DiBag.createBuilder().withServices({ a: () => 1, b: () => 2 }).buildModule({ exportedServiceKeys: ['a', 'b'] });
// diagnostic: not assignable
const fewerProvides: Module<{ a: number }, {}> = noNeeds;
const needs = DiBag.createBuilder().withServices({ value: ({ x, y }: { x: number; y: string }) => [x, y] }).buildModule({ exportedServiceKeys: ['value'] });
type NeedsConstraints = typeof needs extends Module<infer _P, infer _R, infer C> ? C : never;
// diagnostic: not assignable
const fewerRequires: Module<ModuleExportedServices<typeof needs>, { x: number }, NeedsConstraints> = needs;
void [annotated, fewer, fake, erasedBuilder, erasedBag, erasedOpen];
