import { DiBag } from 'di-bag';

const clockKey = Symbol('clock');
const clock = DiBag.token(clockKey).of<{ now(): number }>();
const token = clock;

const feature = DiBag.createBuilder()
  .register({ config: () => ({ region: 'eu' }) })
  .register(clock, () => ({ now: () => 42 }))
  .alias('now', clock)
  .buildModule(['now', 'config'], { label: 'feature' });

const provider = DiBag.withLifetime(() => ({ region: 'eu' }), 'root', { allowScopedDependencies: true });
const stamp = DiBag.fromFunction([clock], source => source.now(), { acquisitionMode: 'raw' });

const root = DiBag.createBuilder()
  .register(token, () => ({ now: () => 1 }))
  .register({
    config: provider,
    stamp,
    session: ({ config }: { config: { region: string } }) => ({ region: config.region }),
  })
  .build();

export const plainChild = root.createScope();
export const sharing = root.createScope({ share: ['session'] });
export const replacing = root.createScope(['config'], { config: () => ({ region: 'us' }) }, { share: ['session'] });
export const test = root.fork(
  ['config'],
  {
    config: () => ({ region: 'test' }),
  },
);
export const sealed = feature;

const overrides = [['config'], { config: () => ({ region: 'x' }) }] as const;
export const spread = root.fork(...overrides);
const shareOptions = { share: ['session'] } as const;
export const indirect = root.createScope(['config'], { config: () => ({ region: 'y' }) }, shareOptions);
