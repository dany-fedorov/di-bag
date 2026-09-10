import { DiBag, type ModuleExportedServices, type ModuleRequiredServices } from '../../../src';
import { feature } from './feature';
import type { Assert, Equal } from '../assert';
const installed = DiBag.createBuilder().installModule(feature).register({ logger: () => ({ log(_message: string) {} }) });
const root = installed.build();
const child = root.fork(['service'], { service: () => ({ read() { return 1; }, extra() { return false; } }) });
const handler = child.resolve('handler');
const promised = child.resolve('promised');
type Handler = Assert<Equal<typeof handler, { run(): number }>>;
type Promised = Assert<Equal<typeof promised, Promise<number>>>;
type Provides = Assert<Equal<ModuleExportedServices<typeof feature>['promised'], Promise<number>>>;
type Requires = Assert<Equal<keyof ModuleRequiredServices<typeof feature>, 'logger'>>;
const annotated: typeof feature = feature;
const reinstalled = DiBag.createBuilder().installModule(annotated).register({ logger: () => ({ log(_message: string) {} }) }).build();
const renamed = DiBag.createBuilder().installModule(feature.renameExport('service', 'different')).register({ logger: () => ({ log(_message: string) {} }) }).build();
const renamedChild = renamed.fork(['different'], { different: () => ({ read() { return 9; }, extra() { return true; } }) });
const renamedResult: number = renamedChild.resolve('handler').run();
const richer = root.fork(['service', 'handler'], {
  service: () => ({ read() { return 3; }, extra() { return true; }, richer() { return 9; } }),
  handler: ({ service }: { service: { richer(): number } }) => ({ run() { return service.richer(); } }),
});
const richerResult: number = richer.resolve('handler').run();
const promiseChild = root.fork(['promised'], { promised: async () => 9 });
const overriddenPromise: Promise<number> = promiseChild.resolve('promised');
// Infer a richer selected-to-selected async edge before contextual fork checking.
const asyncOverrides = {
  service: () => ({ read() { return 3; }, extra() { return true; }, richer() { return 9; } }),
  promised: async ({ service }: { service: { richer(): number } }) => service.richer(),
};
const asyncRicher = root.fork(['service', 'promised'], asyncOverrides);
const asyncRicherPromise = asyncRicher.resolve('promised');
type AsyncRicher = Assert<Equal<typeof asyncRicherPromise, Promise<number>>>;
const owned = DiBag.createModuleBuilder().register({
  resource: DiBag.withDisposal(async () => ({ read() { return Number(7); } }), resource => {
    const value: number = resource.read(); void value;
  }),
}).buildModule(['resource']);
const ownedResult = DiBag.createBuilder().installModule(owned).build().resolve('resource');
type FactoryWithDisposal = Assert<Equal<typeof ownedResult, Promise<{ read(): number }>>>;
const bagAnnotated: typeof root = root.fork();
const moduleBuilder = DiBag.createModuleBuilder().register({ value: () => 1 }).replace('value', () => ({ read() { return 2; } }));
const replaced = DiBag.createBuilder().installModule(moduleBuilder.buildModule(['value'])).build().resolve('value');
type Replaced = Assert<Equal<typeof replaced, { read(): number }>>;
const empty = DiBag.createModuleBuilder().register({ privateValue: ({ later }: { later: number }) => later }).buildModule([]);
DiBag.createBuilder().installModule(empty).register({ later: () => 1 }).build();
void [annotated, bagAnnotated, reinstalled, renamedResult, richerResult, overriddenPromise];
