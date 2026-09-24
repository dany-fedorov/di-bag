import { DiBag, type ModuleExportedServices, type ModuleRequiredServices } from '../../../src';
import { feature } from './feature';
import type { Assert, Equal } from '../assert';
const installed = DiBag.createBuilder().withInstalledModules([feature]).withServices({ logger: () => ({ log(_message: string) {} }) });
const root = installed.buildContainer();
const child = root.createIndependentContainer(['service'], { service: () => ({ read() { return 1; }, extra() { return false; } }) });
const handler = child.resolve('handler');
const promised = child.resolve('promised');
type Handler = Assert<Equal<typeof handler, { run(): number }>>;
type Promised = Assert<Equal<typeof promised, Promise<number>>>;
type Provides = Assert<Equal<ModuleExportedServices<typeof feature>['promised'], Promise<number>>>;
type Requires = Assert<Equal<keyof ModuleRequiredServices<typeof feature>, 'logger'>>;
const annotated: typeof feature = feature;
const reinstalled = DiBag.createBuilder().withInstalledModules([annotated]).withServices({ logger: () => ({ log(_message: string) {} }) }).buildContainer();
const renamed = DiBag.createBuilder().withInstalledModules([feature.withRenamedExport({ currentExportKey: 'service', newExportKey: 'different' })]).withServices({ logger: () => ({ log(_message: string) {} }) }).buildContainer();
const renamedChild = renamed.createIndependentContainer(['different'], { different: () => ({ read() { return 9; }, extra() { return true; } }) });
const renamedResult: number = renamedChild.resolve('handler').run();
const richer = root.createIndependentContainer(['service', 'handler'], {
  service: () => ({ read() { return 3; }, extra() { return true; }, richer() { return 9; } }),
  handler: ({ service }: { service: { richer(): number } }) => ({ run() { return service.richer(); } }),
});
const richerResult: number = richer.resolve('handler').run();
const promiseChild = root.createIndependentContainer(['promised'], { promised: async () => 9 });
const overriddenPromise: Promise<number> = promiseChild.resolve('promised');
// Infer a richer selected-to-selected async edge before contextual fork checking.
const asyncOverrides = {
  service: () => ({ read() { return 3; }, extra() { return true; }, richer() { return 9; } }),
  promised: async ({ service }: { service: { richer(): number } }) => service.richer(),
};
const asyncRicher = root.createIndependentContainer(['service', 'promised'], asyncOverrides);
const asyncRicherPromise = asyncRicher.resolve('promised');
type AsyncRicher = Assert<Equal<typeof asyncRicherPromise, Promise<number>>>;
const owned = DiBag.createBuilder().withServices({
  resource: DiBag.providerWithDisposal({ provider: async () => ({ read() { return Number(7); } }), disposeService: resource => {
    const value: number = resource.read(); void value;
  } }),
}).buildModule({ exportedServiceKeys: ['resource'] });
const ownedResult = DiBag.createBuilder().withInstalledModules([owned]).buildContainer().resolve('resource');
type FactoryWithDisposal = Assert<Equal<typeof ownedResult, Promise<{ read(): number }>>>;
const bagAnnotated: typeof root = root.createIndependentContainer();
const moduleBuilder = DiBag.createBuilder().withServices({ value: () => 1 }).withReplacedService('value', () => ({ read() { return 2; } }));
const replaced = DiBag.createBuilder().withInstalledModules([moduleBuilder.buildModule({ exportedServiceKeys: ['value'] })]).buildContainer().resolve('value');
type Replaced = Assert<Equal<typeof replaced, { read(): number }>>;
const empty = DiBag.createBuilder().withServices({ privateValue: ({ later }: { later: number }) => later }).buildModule({ exportedServiceKeys: [] });
DiBag.createBuilder().withInstalledModules([empty]).withServices({ later: () => 1 }).buildContainer();
void [annotated, bagAnnotated, reinstalled, renamedResult, richerResult, overriddenPromise];
