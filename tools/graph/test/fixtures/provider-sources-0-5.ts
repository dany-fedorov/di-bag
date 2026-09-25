import { DiBag } from 'di-bag';
const clockKey = Symbol('clock');
const clock = DiBag.createToken(clockKey).forService<{ now(): number }>();
export const app = DiBag.createBuilder()
  .withTokenService(clock, () => ({ now: () => 1 }))
  .withServices({
    config: () => ({ prefix: 'v' }),
    stamp: DiBag.createProviderFromFunction({ dependencies: [clock], factoryFunction: async value => value.now() }),
    client: DiBag.createProviderFromClass({ dependencies: [clock], serviceClass: class Client { constructor(readonly clock: { now(): number }) {} } }),
    db: DiBag.createProvider(async ({ config }: { config: { prefix: string } }) => config.prefix),
  })
  .buildContainer();
