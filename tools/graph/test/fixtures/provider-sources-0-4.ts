import { DiBag } from './provider-sources-0-4-library.js';
const clock = DiBag.token(Symbol('clock')).of<{ now(): number }>();
export const app = DiBag.createBuilder()
  .register(clock, () => ({ now: () => 1 }))
  .register({
    config: () => ({ prefix: 'v' }),
    stamp: DiBag.fromFunction([clock], async value => value.now()),
    client: DiBag.fromClass([clock], class Client { constructor(readonly clock: { now(): number }) {} }),
    db: DiBag.fromFactory(async ({ config }: { config: { prefix: string } }) => config.prefix),
  })
  .build();
