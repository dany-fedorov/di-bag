import { DiBag } from 'di-bag';

type Controller = { readonly path: string };

const controllersKey = Symbol('controllers');
export const controllers = DiBag.token(controllersKey).forCollectionOf<Controller>();

const clockKey = Symbol('clock');
const clock = DiBag.token(clockKey).of<{ now(): number }>();

// One token on both channels: a single service is registered under it and providers are contributed to it.
const loggerKey = Symbol('logger');
const logger = DiBag.token(loggerKey).of<string>();

const feature = DiBag.createBuilder()
  .withCollectionContribution({
    collectionToken: controllers,
    provider: () => ({ path: '/users' }),
  })
  .buildModule({ exportedServiceKeys: [] });

const builder = DiBag.createBuilder()
  .withInstalledModules([feature])
  .withTokenService(clock, () => ({ now: () => 0 }))
  .withCollectionContribution({ collectionToken: controllers, provider: () => ({ path: '/orders' }) })
  .withCollectionContribution({ collectionToken: logger, provider: () => 'console' })
  .withTokenService(logger, () => 'fan-out')
  .withServices({
    router: DiBag.fromFunction([clock, controllers], (time, list) => `${time.now()}:${list.length}`),
    sinks: DiBag.fromFunction([DiBag.all(logger)], list => list.join(',')),
  });

export const bag = builder.buildContainer();
export const paths = bag.resolveCollection(controllers).map(controller => controller.path);
export const snapshots = bag.serviceSnapshot(controllers);
export const overrides = { [controllers.key]: () => [] };
export type ControllersToken = typeof controllers;
export const sinks = bag.resolveAll(logger);
export const stamp = bag.resolve(clock).now();

export function later(token: ControllersToken) {
  return bag.resolveAll(token);
}
