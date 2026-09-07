/** Assertions executed against both physical emitter archives and module formats. */
export const dependencyReferenceRuntimeAssertions = `
  {
    const assertReference = (condition, message) => { if (!condition) throw new Error(message); };
    const numberKey = Symbol('optional number');
    const number = DiBag.token(numberKey).of();
    const maybeNumber = DiBag.fromFunction([DiBag.optional(number)], value => value);
    const absent = DiBag.begin().add({ maybeNumber }).end();
    assertReference(absent.resolve('maybeNumber') === undefined, 'missing optional target did not remain absent');
    await absent.close();
    let undefinedDisposed = 0;
    const present = DiBag.begin().bind(number, DiBag.withDisposal(() => undefined,
      value => { assertReference(value === undefined, 'present undefined ownership changed'); undefinedDisposed++; }))
      .add({ maybeNumber }).end();
    assertReference(present.resolve('maybeNumber') === undefined, 'present undefined changed');
    await present.close();
    assertReference(undefinedDisposed === 1, 'optional present undefined was not acquired');
    const failure = new Error('optional factory failure');
    const failing = DiBag.begin().bind(number, () => { throw failure; }).add({ maybeNumber }).end();
    let observed;
    try { failing.resolve('maybeNumber'); } catch (error) { observed = error; }
    assertReference(observed === failure, 'optional acquisition swallowed the factory failure');
    await failing.close();

    const promiseKey = Symbol('optional promise');
    const promised = DiBag.token(promiseKey).of();
    const pending = Promise.resolve(7);
    let rawDisposed = 0;
    const promiseBag = DiBag.begin().bind(promised, () => pending).add({
      maybe: DiBag.withDisposal(DiBag.fromFunction([DiBag.optional(promised)], value => value,
        { acquisition: 'raw' }), value => { assertReference(value === pending, 'raw optional disposer value changed'); rawDisposed++; }),
      later: DiBag.fromTokens([DiBag.lazy(promised)], get => get),
    }).end();
    assertReference(promiseBag.resolve('maybe') === pending && promiseBag.resolve('later')() === pending,
      'reference implicitly awaited a Promise dependency');
    await promiseBag.close();
    assertReference(rawDisposed === 1, 'raw optional ownership lost');

    const serviceKey = Symbol('deferred service');
    const service = DiBag.token(serviceKey).of();
    const cleanup = [];
    let created = 0;
    let overrides = 0;
    let signal;
    const target = DiBag.withLifetime(DiBag.withDisposal(DiBag.withContext((_deps, context) => {
      signal = context.signal;
      return { id: ++created, owner: 'parent' };
    }), value => { cleanup.push(value.id); }), 'transient');
    class Reader { constructor(get) { this.get = get; } }
    const reader = DiBag.fromClass([DiBag.lazy(service)], Reader);
    const parent = DiBag.begin().bind(service, target).add({ reader }).end();
    const child = parent.scope([service], { [serviceKey]: () => { overrides++; return { id: -1, owner: 'child' }; } },
      { share: ['reader'] });
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
