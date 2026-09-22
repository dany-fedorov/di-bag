import { DiBag } from 'di-bag';

type Controller = { readonly path: string };

const controllersKey = Symbol('controllers');
export const controllers = DiBag.token(controllersKey).of<Controller>();

const clockKey = Symbol('clock');
const clock = DiBag.token(clockKey).of<{ now(): number }>();

// One token on both channels: a single service is registered under it and providers are contributed to it.
const loggerKey = Symbol('logger');
const logger = DiBag.token(loggerKey).of<string>();

const feature = DiBag.createBuilder()
  .contribute(
    controllers,
    () => ({ path: '/users' }),
  )
  .buildModule([]);

const builder = DiBag.createBuilder()
  .installModule(feature)
  .register(clock, () => ({ now: () => 0 }))
  .contribute(controllers, () => ({ path: '/orders' }))
  .contribute(logger, () => 'console')
  .register(logger, () => 'fan-out')
  .register({
    router: DiBag.fromFunction([clock, DiBag.all(controllers)], (time, list) => `${time.now()}:${list.length}`),
    sinks: DiBag.fromFunction([DiBag.all(logger)], list => list.join(',')),
  });

export const bag = builder.build();
export const paths = bag.resolveAll(controllers).map(controller => controller.path);
export const snapshots = bag.inspectAll(controllers);
export const overrides = { [controllers.key]: () => [] };
export type ControllersToken = typeof controllers;
export const sinks = bag.resolveAll(logger);
export const stamp = bag.resolve(clock).now();

export function later(token: ControllersToken) {
  return bag.resolveAll(token);
}
