import { DiBag } from '../../src';
import type { CollectionToken, RegistrationSnapshot } from '../../src';

const controllersSymbol = Symbol('controllers');
type Controller = { readonly path: string };
const controllers = DiBag.token(controllersSymbol).forCollectionOf<Controller>();
const emptySymbol = Symbol('empty');
const empty = DiBag.token(emptySymbol).forCollectionOf<number>();
controllers satisfies CollectionToken<typeof controllersSymbol, Controller>;

const module = DiBag.createBuilder()
  .withCollectionContribution({ collectionToken: controllers, provider: () => ({ path: '/users' }) })
  .withServices({ count: DiBag.fromFunction([controllers], list => list.length) })
  .buildModule({ exportedServiceKeys: ['count'] });

const builder = DiBag.createBuilder()
  .withInstalledModules([module])
  .withCollectionContribution({ collectionToken: controllers, provider: () => ({ path: '/orders' }) })
  .withServiceAlias({ aliasKey: 'controllers', targetServiceKey: controllers })
  .withServices({
    first: ({ controllers }: { controllers: readonly Controller[] }) => controllers[0],
    lazy: DiBag.fromFunction([DiBag.lazy(controllers)], get => get),
  });
const bag = builder.buildContainer();
bag.resolveCollection(controllers) satisfies readonly Controller[];
bag.resolveCollection(empty) satisfies readonly number[];
bag.serviceSnapshot(controllers) satisfies readonly RegistrationSnapshot<object, readonly unknown[]>[];
bag.resolve('controllers') satisfies readonly Controller[];
bag.resolve('lazy') satisfies () => readonly Controller[];
bag.ensureServicesReady([controllers, empty] as const) satisfies Promise<typeof bag>;

const replacement = (): readonly Controller[] => [{ path: '/fake' }];
const replaced = bag.createIndependentContainer([controllers] as const, { [controllers.key]: replacement });
replaced.resolveCollection(controllers) satisfies readonly Controller[];
// @ts-expect-error collection replacement must not introduce broad string lookup keys
replaced.resolve('missing');
// @ts-expect-error ordinary resolve remains single-service-only after collection replacement
replaced.resolve(controllers);
bag.createIndependentContainer([controllers, 'first'] as const, {
  [controllers.key]: replacement,
  first: ({ controllers }: { controllers: readonly Controller[] }) => controllers[0],
}).resolve('first') satisfies Controller | undefined;
bag.createChildContainer([controllers] as const, { [controllers.key]: replacement }).resolveCollection(controllers) satisfies readonly Controller[];
builder.withReplacedService(controllers, replacement).buildContainer().resolveCollection(controllers) satisfies readonly Controller[];
