import { DiBag } from 'di-bag';

const clockKey = Symbol('clock');
const clock = DiBag.token(clockKey).of<{ now(): number }>();
const token = clock;

const feature = DiBag.createBuilder()
  .withServices({ config: () => ({ region: 'eu' }) })
  .withTokenService({ token: clock, provider: () => ({ now: () => 42 }) })
  .withServiceAlias({ 'alias-key': 'now', 'target service key': clock })
  .buildModule({ exportedServiceKeys: ['now', 'config'], moduleLabel: 'feature' });

const provider = DiBag.withLifetime({ provider: () => ({ region: 'eu' }), lifetime: 'singleton:one-per-container-tree' }, { allowScopedDependencies: true });
const stamp = DiBag.createProviderFromFunction({ dependencies: [clock], factoryFunction: source => source.now() });

const root = DiBag.createBuilder()
  .withTokenService({ token, provider: () => ({ now: () => 1 }) })
  .withServices({
    config: provider,
    stamp,
    session: ({ config }: { config: { region: string } }) => ({ region: config.region }),
  })
  .build();

export const plainChild = root.createChildContainer();
export const sharing = root.createChildContainer({ sharedParentServiceKeys: ['session'] });
export const replacing = root.createChildContainer({ replacedServiceKeys: ['config'], replacementProviders: { config: () => ({ region: 'us' }) }, sharedParentServiceKeys: ['session'] });
export const test = root.createIndependentContainer({
  replacedServiceKeys: ['config'],
  replacementProviders: {
    config: () => ({ region: 'test' }),
  },
});
export const sealed = feature;

const overrides = [['config'], { config: () => ({ region: 'x' }) }] as const;
export const spread = root.fork(...overrides);
const shareOptions = { share: ['session'] } as const;
export const indirect = root.createScope(['config'], { config: () => ({ region: 'y' }) }, shareOptions);
