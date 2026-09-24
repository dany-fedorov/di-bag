/** Assertions executed against both physical emitter archives and module formats. */
export const dependencyReferenceRuntimeAssertions = `
  {
    const assertReference = (condition, message) => { if (!condition) throw new Error(message); };
    const numberKey = Symbol('optional number');
    const number = DiBag.createToken(numberKey).forService();
    const maybeNumber = DiBag.providerWithLifetime({ provider: DiBag.createProviderFromFunction({ dependencies: [DiBag.optional(number)], factoryFunction: value => value }), lifetime: 'scoped:one-per-container' });
    const absent = DiBag.createBuilder().withServices({ maybeNumber }).buildContainer();
    assertReference(absent.resolve('maybeNumber') === undefined, 'missing optional target did not remain absent');
    await absent.close();
    let undefinedDisposed = 0;
    const present = DiBag.createBuilder().withTokenService(number, DiBag.providerWithLifetime({ provider: DiBag.providerWithDisposal({ provider: () => undefined, disposeService: value => { assertReference(value === undefined, 'present undefined ownership changed'); undefinedDisposed++; } }), lifetime: 'scoped:one-per-container' })).withServices({ maybeNumber }).buildContainer();
    assertReference(present.resolve('maybeNumber') === undefined, 'present undefined changed');
    await present.close();
    assertReference(undefinedDisposed === 1, 'optional present undefined was not acquired');
    const failure = new Error('optional factory failure');
    const failing = DiBag.createBuilder().withTokenService(number, DiBag.providerWithLifetime({ provider: () => { throw failure; }, lifetime: 'scoped:one-per-container' })).withServices({ maybeNumber }).buildContainer();
    let observed;
    try { failing.resolve('maybeNumber'); } catch (error) { observed = error; }
    assertReference(observed === failure, 'optional acquisition swallowed the factory failure');
    await failing.close();

    const promiseKey = Symbol('optional promise');
    const promised = DiBag.createToken(promiseKey).forService();
    const pending = Promise.resolve(7);
    let rawDisposed = 0;
    const promiseBag = DiBag.createBuilder().withTokenService(promised, DiBag.providerWithLifetime({ provider: () => pending, lifetime: 'scoped:one-per-container' })).withServices({
      maybe: DiBag.providerWithLifetime({ provider: DiBag.providerWithDisposal({ provider: DiBag.createProviderFromFunction({ dependencies: [DiBag.optional(promised)], factoryFunction: value => value,
        factoryReturnKind: 'uninspected' }), disposeService: value => { assertReference(value === pending, 'raw optional disposer value changed'); rawDisposed++; } }), lifetime: 'scoped:one-per-container' }),
      later: DiBag.providerWithLifetime({ provider: DiBag.createProviderFromFunction({ dependencies: [DiBag.lazy(promised)], factoryFunction: get => get }), lifetime: 'scoped:one-per-container' }),
    }).buildContainer();
    assertReference(promiseBag.resolve('maybe') === pending && promiseBag.resolve('later')() === pending,
      'reference implicitly awaited a Promise dependency');
    await promiseBag.close();
    assertReference(rawDisposed === 1, 'raw optional ownership lost');

    const serviceKey = Symbol('deferred service');
    const service = DiBag.createToken(serviceKey).forService();
    const cleanup = [];
    let created = 0;
    let overrides = 0;
    let signal;
    const target = DiBag.providerWithLifetime({ provider: DiBag.providerWithDisposal({ provider: DiBag.createProvider((_deps, context) => {
      signal = context.abortSignal;
      return { id: ++created, owner: 'parent' };
    }, { factoryReceivesContext: true }), disposeService: value => { cleanup.push(value.id); } }), lifetime: 'transient:one-per-resolve' });
    class Reader { constructor(get) { this.get = get; } }
    const reader = DiBag.providerWithLifetime({ provider: DiBag.createProviderFromClass({ dependencies: [DiBag.lazy(service)], serviceClass: Reader }), lifetime: 'scoped:one-per-container' });
    const parent = DiBag.createBuilder().withTokenService(service, target).withServices({ reader }).buildContainer();
    const child = parent.createChildContainer([service], { [serviceKey]: DiBag.providerWithLifetime({ provider: () => { overrides++; return { id: -1, owner: 'child' }; }, lifetime: 'scoped:one-per-container' }) },
      { sharedParentServiceKeys: ['reader'] });
    const sharedReader = child.resolve('reader');
    assertReference(sharedReader instanceof Reader && sharedReader === parent.resolve('reader'), 'lazy class reader identity changed');
    assertReference(created === 0 && overrides === 0, 'lazy target acquired before invocation');
    const first = sharedReader.get();
    const second = sharedReader.get();
    assertReference(first !== second && first.id === 1 && second.id === 2 && overrides === 0,
      'lazy calls lost transient multiplicity or parent lexical context');
    await child.close();
    assertReference(cleanup.length === 0 && signal.aborted === false, 'child closed the shared reader owner');
    assertReference(sharedReader.get().id === 3, 'parent-owned closure stopped when child closed');
    await parent.close();
    assertReference(signal.aborted && cleanup.length === 3 && new Set(cleanup).size === 3,
      'deferred transient ownership or context cleanup changed');
    observed = undefined;
    try { sharedReader.get(); } catch (error) { observed = error; }
    assertReference(observed instanceof Error && /bag is closed/.test(observed.message), 'lazy closure outlived the owner');
  }
`;
