import { DiBag } from '../../src';
import type { CollectionToken, RegistrationSnapshot } from '../../src';

const controllersSymbol = Symbol('controllers');
type Controller = { readonly path: string };
const controllers = DiBag.token(controllersSymbol).forCollectionOf<Controller>();
const emptySymbol = Symbol('empty');
const empty = DiBag.token(emptySymbol).forCollectionOf<number>();
controllers satisfies CollectionToken<typeof controllersSymbol, Controller>;

const module = DiBag.createBuilder()
  .contribute(controllers, () => ({ path: '/users' }))
  .register({ count: DiBag.fromFunction([controllers], list => list.length) })
  .buildModule(['count']);

const builder = DiBag.createBuilder()
  .installModule(module)
  .contribute(controllers, () => ({ path: '/orders' }))
  .alias('controllers', controllers)
  .register({
    first: ({ controllers }: { controllers: readonly Controller[] }) => controllers[0],
    lazy: DiBag.fromFunction([DiBag.lazy(controllers)], get => get),
  });
const bag = builder.build();
bag.resolveCollection(controllers) satisfies readonly Controller[];
bag.resolveCollection(empty) satisfies readonly number[];
bag.inspectCollection(controllers) satisfies readonly RegistrationSnapshot<object, readonly unknown[]>[];
bag.resolve('controllers') satisfies readonly Controller[];
bag.resolve('lazy') satisfies () => readonly Controller[];
bag.ensureServicesReady([controllers, empty] as const) satisfies Promise<typeof bag>;

const replacement = (): readonly Controller[] => [{ path: '/fake' }];
const replaced = bag.fork([controllers] as const, { [controllers.key]: replacement });
replaced.resolveCollection(controllers) satisfies readonly Controller[];
// @ts-expect-error collection replacement must not introduce broad string lookup keys
replaced.resolve('missing');
// @ts-expect-error ordinary resolve remains single-service-only after collection replacement
replaced.resolve(controllers);
bag.fork([controllers, 'first'] as const, {
  [controllers.key]: replacement,
  first: ({ controllers }: { controllers: readonly Controller[] }) => controllers[0],
}).resolve('first') satisfies Controller | undefined;
bag.createScope([controllers] as const, { [controllers.key]: replacement }).resolveCollection(controllers) satisfies readonly Controller[];
builder.replace(controllers, replacement).build().resolveCollection(controllers) satisfies readonly Controller[];
