import { describe, expect, test } from 'bun:test';
import { DiBag } from '../src';

type OrdersConfig = { currency: string };
type BillingConfig = { vatRate: number };

const ordersModule = DiBag.createBuilder().withServices({
  store: () => ({ prefix: 'order:' }),
  orders: ({ config, store }: { config: OrdersConfig; store: { prefix: string } }) => store.prefix + config.currency,
}).buildModule({ exportedServiceKeys: ['orders'], moduleLabel: 'orders' });
const billingModule = DiBag.createBuilder().withServices({
  billing: ({ config }: { config: BillingConfig }) => config.vatRate,
}).buildModule({ exportedServiceKeys: ['billing'], moduleLabel: 'billing' });

describe('module requirement renaming', () => {
  test('installs modules with incompatible requirements that originally share a name', async () => {
    const container = DiBag.createBuilder().withInstalledModules([
      ordersModule.withRenamedRequirement({ currentRequirementKey: 'config', newRequirementKey: 'ordersConfig' }),
      billingModule.withRenamedRequirement({ currentRequirementKey: 'config', newRequirementKey: 'billingConfig' }),
    ]).withServices({
      ordersConfig: (): OrdersConfig => ({ currency: 'EUR' }),
      billingConfig: (): BillingConfig => ({ vatRate: 0.2 }),
    }).buildContainer();
    expect(container.resolve('orders')).toBe('order:EUR');
    expect(container.resolve('billing')).toBe(0.2);
    expect(container.graphSnapshot().bindings.map(binding => binding.bindingLabel)).toContain('orders/store');
    expect(container.serviceSnapshot('orders').bindingLabel).toBe('orders');
    await container.close();
  });

  test('a renamed requirement can resolve another module export', async () => {
    const configModule = DiBag.createBuilder().withServices({ ordersConfig: (): OrdersConfig => ({ currency: 'GBP' }) })
      .buildModule({ exportedServiceKeys: ['ordersConfig'] });
    const container = DiBag.createBuilder().withInstalledModules([
      ordersModule.withRenamedRequirement({ currentRequirementKey: 'config', newRequirementKey: 'ordersConfig' }),
      configModule,
    ]).buildContainer();
    expect(container.resolve('orders')).toBe('order:GBP');
    await container.close();
  });

  test('nested modules forward and rename a requirement again without changing the factory parameter', async () => {
    const inner = ordersModule.withRenamedRequirement({ currentRequirementKey: 'config', newRequirementKey: 'featureConfig' });
    const outer = DiBag.createBuilder().withInstalledModules([inner])
      .buildModule({ exportedServiceKeys: ['orders'], moduleLabel: 'outer' })
      .withRenamedRequirement({ currentRequirementKey: 'featureConfig', newRequirementKey: 'applicationConfig' });
    const container = DiBag.createBuilder().withInstalledModules([outer])
      .withServices({ applicationConfig: (): OrdersConfig => ({ currency: 'UAH' }) }).buildContainer();
    expect(container.resolve('orders')).toBe('order:UAH');
    expect(container.graphSnapshot().bindings.map(binding => binding.bindingLabel)).toContain('outer/orders/store');
    await container.close();
  });

  test('private names shadow requirement maps and export views compose in either order', async () => {
    const local = DiBag.createBuilder().withServices({
      config: () => 7,
      service: ({ config }: { config: number }) => config,
    }).buildModule({ exportedServiceKeys: ['service'] });
    const exported = local.withRenamedExport({ currentExportKey: 'service', newExportKey: 'answer' });
    const exportFirst = ((exported.withRenamedRequirement as Function)({ currentRequirementKey: 'config', newRequirementKey: 'ignored' })) as typeof exported;
    const requirementFirst = ((local.withRenamedRequirement as Function)({ currentRequirementKey: 'config', newRequirementKey: 'ignored' }) as typeof local)
      .withRenamedExport({ currentExportKey: 'service', newExportKey: 'answer' });
    for (const module of [exportFirst, requirementFirst]) {
      const container = DiBag.createBuilder().withInstalledModules([module]).buildContainer();
      expect(container.resolve('answer')).toBe(7);
      await container.close();
    }
  });

  test('renames a requirement used by a sealed collection contribution', async () => {
    const valuesKey = Symbol('values');
    const values = DiBag.createToken(valuesKey).forCollectionOf<string>();
    const feature = DiBag.createBuilder().withCollectionContribution({
      collectionToken: values,
      provider: ({ config }: { config: OrdersConfig }) => config.currency,
    }).buildModule({ exportedServiceKeys: [] })
      .withRenamedRequirement({ currentRequirementKey: 'config', newRequirementKey: 'ordersConfig' });
    const container = DiBag.createBuilder().withInstalledModules([feature])
      .withServices({ ordersConfig: (): OrdersConfig => ({ currency: 'EUR' }) }).buildContainer();
    expect(container.resolveCollection(values)).toEqual(['EUR']);
    await container.close();
  });

  test('preserves token-kind claims through nested requirement-renamed modules', () => {
    const key = Symbol('shared-kind');
    const serviceToken = DiBag.createToken(key).forService<number>();
    const collectionToken = DiBag.createToken(key).forCollectionOf<number>();
    const inner = DiBag.createBuilder()
      .withTokenService(serviceToken, ({ config }: { config: OrdersConfig }) => config.currency.length)
      .buildModule({ exportedServiceKeys: [serviceToken] })
      .withRenamedRequirement({ currentRequirementKey: 'config', newRequirementKey: 'innerConfig' });
    const outer = DiBag.createBuilder().withInstalledModules([inner])
      .buildModule({ exportedServiceKeys: [serviceToken] })
      .withRenamedRequirement({ currentRequirementKey: 'innerConfig', newRequirementKey: 'outerConfig' });
    let failure: unknown;
    try {
      DiBag.createBuilder()
        .withCollectionContribution({ collectionToken, provider: () => 1 })
        .withInstalledModules([outer]);
    } catch (error) {
      failure = error;
    }
    expect(failure).toMatchObject({
      code: 'DI_BAG_WRONG_TOKEN_KIND',
      details: {
        operation: 'withInstalledModules',
        expectedKind: 'collection',
        receivedKind: 'single-service',
      },
    });
  });

  test('returns immutable views and snapshots the options bag', () => {
    const options = { currentRequirementKey: 'config', newRequirementKey: 'ordersConfig' } as const;
    const renamed = ordersModule.withRenamedRequirement(options);
    expect(renamed).not.toBe(ordersModule);
    expect(Object.isFrozen(renamed)).toBe(true);
    expect(renamed.withRenamedRequirement({ currentRequirementKey: 'ordersConfig', newRequirementKey: 'ordersConfig' })).toBe(renamed);
  });

  test('rejects malformed bags, known exports, stale names, and recorded collisions with final codes', () => {
    const feature = DiBag.createBuilder().withServices({
      shown: () => 1,
      result: ({ first, second }: { first: number; second: number }) => first + second,
    }).buildModule({ exportedServiceKeys: ['shown', 'result'] });
    const malformed = () => (feature.withRenamedRequirement as Function)({ currentRequirementKey: 1, newRequirementKey: 'x' });
    expect(malformed).toThrow('currentRequirementKey');
    try { malformed(); } catch (error: any) {
      expect(error.code).toBe('DI_BAG_INVALID_ARGUMENT');
      expect(error.details).toEqual({ operation: 'withRenamedRequirement', argument: 'currentRequirementKey', expected: 'a string' });
    }
    const unknown = () => (feature.withRenamedRequirement as Function)({ currentRequirementKey: 'shown', newRequirementKey: 'x' });
    expect(unknown).toThrow('existing requirement');
    try { unknown(); } catch (error: any) {
      expect(error.code).toBe('DI_BAG_UNKNOWN_SERVICE_KEY');
      expect(error.details).toEqual({ operation: 'withRenamedRequirement', serviceKey: 'shown' });
    }
    const first = (feature.withRenamedRequirement as Function)({ currentRequirementKey: 'first', newRequirementKey: 'one' });
    const second = (first.withRenamedRequirement as Function)({ currentRequirementKey: 'second', newRequirementKey: 'two' });
    const collision = () => (second.withRenamedRequirement as Function)({ currentRequirementKey: 'one', newRequirementKey: 'two' });
    expect(collision).toThrow('duplicate service key');
    try { collision(); } catch (error: any) {
      expect(error.code).toBe('DI_BAG_DUPLICATE_SERVICE_KEY');
      expect(error.details).toEqual({ operation: 'withRenamedRequirement', serviceKey: 'two' });
    }
    const stale = () => (first.withRenamedRequirement as Function)({ currentRequirementKey: 'first', newRequirementKey: 'other' });
    expect(stale).toThrow('existing requirement');
    try { stale(); } catch (error: any) {
      expect(error.code).toBe('DI_BAG_UNKNOWN_SERVICE_KEY');
      expect(error.details).toEqual({ operation: 'withRenamedRequirement', serviceKey: 'first' });
    }
  });
});
