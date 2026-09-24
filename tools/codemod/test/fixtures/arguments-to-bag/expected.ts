import { DiBag } from 'di-bag';

const clockKey = Symbol('clock');
const clock = DiBag.token(clockKey).of<{ now(): number }>();
const token = clock;

const feature = DiBag.createBuilder()
  .withServices({ config: (DiBag.fromFactory(() => ({ region: 'eu' }))).withLifetime('scoped:one-per-container') })
  .withTokenService({ token: clock, provider: (DiBag.fromFactory(() => ({ now: () => 42 }))).withLifetime('scoped:one-per-container') })
  .withServiceAlias({ 'alias-key': 'now', 'target service key': clock })
  .buildModule({ exportedServiceKeys: ['now', 'config'], moduleLabel: 'feature' });

const provider = DiBag.withLifetime({ provider: () => ({ region: 'eu' }), lifetime: 'singleton:one-per-container-tree' }, { allowScopedDependencies: true });
const stamp = DiBag.createProviderFromFunction({ dependencies: [clock], factoryFunction: source => source.now() });

const root = DiBag.createBuilder()
  .withTokenService({ token, provider: (DiBag.fromFactory(() => ({ now: () => 1 }))).withLifetime('scoped:one-per-container') })
  .withServices({
    config: provider,
    stamp: (stamp).withLifetime('scoped:one-per-container'),
    session: (DiBag.fromFactory(({ config }: { config: { region: string } }) => ({ region: config.region }))).withLifetime('scoped:one-per-container'),
  })
  .build();

export const plainChild = root.createChildContainer();
export const sharing = root.createChildContainer({ sharedParentServiceKeys: ['session'] });
export const replacing = root.createChildContainer({ replacedServiceKeys: ['config'], replacementProviders: { config: (DiBag.fromFactory(() => ({ region: 'us' }))).withLifetime('scoped:one-per-container') }, sharedParentServiceKeys: ['session'] });
export const test = root.createIndependentContainer({
  replacedServiceKeys: ['config'],
  replacementProviders: {
    config: (DiBag.fromFactory(() => ({ region: 'test' }))).withLifetime('scoped:one-per-container'),
  },
});
export const sealed = feature;

const overrides = [['config'], { config: () => ({ region: 'x' }) }] as const;
export const spread = root.fork(...overrides);
const shareOptions = { share: ['session'] } as const;
export const indirect = root.createScope(['config'], { config: (DiBag.fromFactory(() => ({ region: 'y' }))).withLifetime('scoped:one-per-container') }, shareOptions);
