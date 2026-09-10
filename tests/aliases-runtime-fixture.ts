/** Actual archive assertions for aliases and their canonical acquisitions. */
export const aliasRuntimeAssertions = `
  {
    const assertAlias = (condition, message) => { if (!condition) throw new Error(message); };
    const aliasKey = Symbol('resource alias');
    const tokenAlias = DiBag.token(aliasKey).of();
    const pendingKey = Symbol('pending');
    const pending = DiBag.token(pendingKey).of();
    const pendingAliasKey = Symbol('pending alias');
    const pendingAlias = DiBag.token(pendingAliasKey).of();
    const cleanup = [];
    let resourceCalls = 0;
    let transientCalls = 0;
    const promise = Promise.resolve(7);
    const parent = DiBag.createBuilder().register({
      resource: DiBag.withDisposal(() => { resourceCalls++; return { owner: 'parent' }; },
        value => { assertAlias(value.owner === 'parent', 'wrong alias target disposer'); cleanup.push('resource'); }),
      transient: DiBag.withLifetime(DiBag.withDisposal(() => ({ id: ++transientCalls }),
        value => { cleanup.push(value.id); }), 'transient'),
    }).alias('copy', 'resource').alias(tokenAlias, 'copy').alias('localCopy', 'resource').alias('next', 'transient').alias('later', pending).register(pending, DiBag.withDisposal(DiBag.fromFactory(() => promise, { acquisitionMode: 'raw' }),
        value => { assertAlias(value === promise, 'alias raw Promise ownership changed'); cleanup.push('promise'); })).alias(pendingAlias, pending).build();
    assertAlias(resourceCalls === 0 && transientCalls === 0, 'alias eagerly acquired its target');
    const child = parent.createScope(['resource'], { resource: () => ({ owner: 'child' }) }, { share: ['copy'] });
    const borrowed = child.resolve('copy');
    assertAlias(borrowed === parent.resolve('resource') && borrowed === child.resolve(tokenAlias)
      && borrowed.owner === 'parent' && resourceCalls === 1, 'alias chain lost shared parent identity');
    const aliasView = child.inspect('copy');
    const targetView = parent.inspect('resource');
    assertAlias(aliasView.aliasTarget.bindingId === targetView.bindingId && Object.isFrozen(aliasView.aliasTarget)
      && aliasView.acquisitions.length === 1 && aliasView.acquisitions[0].acquisitionId === targetView.acquisitions[0].acquisitionId,
      'shared alias inspection diverged from parent canonical acquisition');
    assertAlias(child.resolve('localCopy') === child.resolve('resource') && child.resolve('resource').owner === 'child',
      'unshared alias bypassed child target override');
    const first = parent.resolve('next');
    const second = parent.resolve('next');
    assertAlias(first !== second && first.id === 1 && second.id === 2, 'alias cached a transient target');
    assertAlias(parent.resolve('later') === promise && parent.resolve(pendingAlias) === promise,
      'token alias wrapped or awaited its target Promise');
    await child.close();
    assertAlias(cleanup.length === 0, 'child disposed alias parent acquisitions');
    await parent.close();
    assertAlias(cleanup.length === 4 && new Set(cleanup).size === 4, 'aliases introduced or lost ownership');

    let privateCalls = 0;
    let privateDisposed = 0;
    const feature = DiBag.createModuleBuilder().register({
      hidden: DiBag.withDisposal(() => { privateCalls++; return { kind: 'private' }; }, () => { privateDisposed++; }),
    }).alias('exported', 'hidden').buildModule(['exported']).renameExport('exported', 'publicAlias');
    const moduleBag = DiBag.createBuilder().installModule(feature).register({ hidden: () => ({ kind: 'host' }) }).build();
    assertAlias(moduleBag.resolve('publicAlias').kind === 'private' && privateCalls === 1,
      'renamed module alias escaped its private lexical target');
    await moduleBag.close();
    assertAlias(privateDisposed === 1, 'private alias target ownership changed');

    let settleNative;
    const nativeValue = { ready: true };
    const nativePromise = new Promise(resolve => { settleNative = resolve; });
    let nativeCalls = 0;
    let nativeDisposals = 0;
    const nativeBag = DiBag.createBuilder().register({
      native: DiBag.withDisposal(DiBag.fromFactory(() => { nativeCalls++; return nativePromise; }, { acquisitionMode: 'nativePromise' }),
        value => { assertAlias(value === nativeValue, 'native alias disposer did not receive fulfilled target'); nativeDisposals++; }),
    }).alias('nativeAlias', 'native').build();
    assertAlias(nativeBag.resolve('nativeAlias') === nativePromise && nativeBag.resolve('native') === nativePromise
      && nativeCalls === 1, 'native alias changed pending Promise identity or added an acquisition');
    const nativeAliasView = nativeBag.inspect('nativeAlias');
    const nativeTargetView = nativeBag.inspect('native');
    assertAlias(nativeAliasView.acquisitions.length === 1 && nativeAliasView.acquisitions[0].state === 'pending'
      && nativeAliasView.acquisitions[0].acquisitionId === nativeTargetView.acquisitions[0].acquisitionId,
      'native alias did not inspect the canonical pending acquisition');
    let nativeClosed = false;
    const nativeClosing = nativeBag.close().then(() => { nativeClosed = true; });
    await new Promise(resolve => setTimeout(resolve, 0));
    assertAlias(!nativeClosed && nativeDisposals === 0, 'native alias close bypassed canonical readiness');
    settleNative(nativeValue);
    await nativeClosing;
    assertAlias(nativeClosed && nativeDisposals === 1 && nativeCalls === 1,
      'native alias did not retain once-only canonical ownership');

    const { DiBag: PortableDiBag } = await import('di-bag');
    const portable = PortableDiBag.createBuilder().register({
      raw: PortableDiBag.fromFactory(() => promise, { acquisitionMode: 'raw' }),
    }).alias('rawAlias', 'raw').build();
    assertAlias(portable.resolve('rawAlias') === promise, 'raw alias required automatic classification or changed identity');
    await portable.close();
  }
`;
