import { DiBag, type ModuleProvides, type ModuleRequires } from '../../../src';
import { feature } from './feature';
import type { Assert, Equal } from '../assert';
const installed = DiBag.begin().install(feature).add({ logger: () => ({ log(_message: string) {} }) });
const root = installed.end();
const child = root.fork(['service'], { service: () => ({ read() { return 1; }, extra() { return false; } }) });
const handler = child.resolve('handler');
const promised = child.resolve('promised');
type Handler = Assert<Equal<typeof handler, { run(): number }>>;
type Promised = Assert<Equal<typeof promised, Promise<number>>>;
type Provides = Assert<Equal<ModuleProvides<typeof feature>['promised'], Promise<number>>>;
type Requires = Assert<Equal<keyof ModuleRequires<typeof feature>, 'logger'>>;
const annotated: typeof feature = feature;
const reinstalled = DiBag.begin().install(annotated).add({ logger: () => ({ log(_message: string) {} }) }).end();
const renamed = DiBag.begin().install(feature.rename('service', 'different')).add({ logger: () => ({ log(_message: string) {} }) }).end();
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
const owned = DiBag.module().add({
  resource: DiBag.withDisposal(async () => ({ read() { return Number(7); } }), resource => {
    const value: number = resource.read(); void value;
  }),
}).exports(['resource']);
const ownedResult = DiBag.begin().install(owned).end().resolve('resource');
type Owned = Assert<Equal<typeof ownedResult, Promise<{ read(): number }>>>;
const bagAnnotated: typeof root = root.fork();
const moduleBuilder = DiBag.module().add({ value: () => 1 }).replace('value', () => ({ read() { return 2; } }));
const replaced = DiBag.begin().install(moduleBuilder.exports(['value'])).end().resolve('value');
type Replaced = Assert<Equal<typeof replaced, { read(): number }>>;
const empty = DiBag.module().add({ privateValue: ({ later }: { later: number }) => later }).exports([]);
DiBag.begin().install(empty).add({ later: () => 1 }).end();
void [annotated, bagAnnotated, reinstalled, renamedResult, richerResult, overriddenPromise];
