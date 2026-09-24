/** Actual archive assertions for aliases and their canonical acquisitions. */
export const aliasRuntimeAssertions = `
  {
    const assertAlias = (condition, message) => { if (!condition) throw new Error(message); };
    const aliasKey = Symbol('resource alias');
    const tokenAlias = DiBag.createToken(aliasKey).forService();
    const pendingKey = Symbol('pending');
    const pending = DiBag.createToken(pendingKey).forService();
    const pendingAliasKey = Symbol('pending alias');
    const pendingAlias = DiBag.createToken(pendingAliasKey).forService();
    const cleanup = [];
    let resourceCalls = 0;
    let transientCalls = 0;
    const promise = Promise.resolve(7);
    const parent = DiBag.createBuilder().withServices({
      resource: DiBag.providerWithDisposal({ provider: () => { resourceCalls++; return { owner: 'parent' }; }, disposeService: value => { assertAlias(value.owner === 'parent', 'wrong alias target disposer'); cleanup.push('resource'); } }),
      transient: DiBag.providerWithLifetime({ provider: DiBag.providerWithDisposal({ provider: () => ({ id: ++transientCalls }), disposeService: value => { cleanup.push(value.id); } }), lifetime: 'transient:one-per-resolve' }),
    }).withServiceAlias({ aliasKey: 'copy', targetServiceKey: 'resource' }).withServiceAlias({ aliasKey: tokenAlias, targetServiceKey: 'copy' }).withServiceAlias({ aliasKey: 'localCopy', targetServiceKey: 'resource' }).withServiceAlias({ aliasKey: 'next', targetServiceKey: 'transient' }).withServiceAlias({ aliasKey: 'later', targetServiceKey: pending }).withTokenService(pending, DiBag.providerWithDisposal({ provider: DiBag.createProvider(() => promise, { factoryReturnKind: 'uninspected' }), disposeService: value => { assertAlias(value === promise, 'alias raw Promise ownership changed'); cleanup.push('promise'); } })).withServiceAlias({ aliasKey: pendingAlias, targetServiceKey: pending }).buildContainer();
    assertAlias(resourceCalls === 0 && transientCalls === 0, 'alias eagerly acquired its target');
    const child = parent.createChildContainer(['resource'], { resource: () => ({ owner: 'child' }) }, { sharedParentServiceKeys: ['copy'] });
    const borrowed = child.resolve('copy');
    assertAlias(borrowed === parent.resolve('resource') && borrowed === child.resolve(tokenAlias)
      && borrowed.owner === 'parent' && resourceCalls === 1, 'alias chain lost shared parent identity');
    const aliasView = child.serviceSnapshot('copy');
    const targetView = parent.serviceSnapshot('resource');
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
    const feature = DiBag.createBuilder().withServices({
      hidden: DiBag.providerWithDisposal({ provider: () => { privateCalls++; return { kind: 'private' }; }, disposeService: () => { privateDisposed++; } }),
    }).withServiceAlias({ aliasKey: 'exported', targetServiceKey: 'hidden' }).buildModule({ exportedServiceKeys: ['exported'] }).withRenamedExport({ currentExportKey: 'exported', newExportKey: 'publicAlias' });
    const moduleBag = DiBag.createBuilder().withInstalledModules([feature]).withServices({ hidden: () => ({ kind: 'host' }) }).buildContainer();
    assertAlias(moduleBag.resolve('publicAlias').kind === 'private' && privateCalls === 1,
      'renamed module alias escaped its private lexical target');
    await moduleBag.close();
    assertAlias(privateDisposed === 1, 'private alias target ownership changed');

    let settleNative;
    const nativeValue = { ready: true };
    const pendingNative = new Promise(resolve => { settleNative = resolve; });
    let nativeCalls = 0;
    let nativeDisposals = 0;
    const nativeBag = DiBag.createBuilder().withServices({
      native: DiBag.providerWithDisposal({ provider: DiBag.createProvider(() => { nativeCalls++; return pendingNative; }, { factoryReturnKind: 'native-promise' }), disposeService: value => { assertAlias(value === nativeValue, 'native alias disposer did not receive fulfilled target'); nativeDisposals++; } }),
    }).withServiceAlias({ aliasKey: 'nativeAlias', targetServiceKey: 'native' }).buildContainer();
    assertAlias(nativeBag.resolve('nativeAlias') === pendingNative && nativeBag.resolve('native') === pendingNative
      && nativeCalls === 1, 'native alias changed pending Promise identity or added an acquisition');
    const nativeAliasView = nativeBag.serviceSnapshot('nativeAlias');
    const nativeTargetView = nativeBag.serviceSnapshot('native');
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
    const portable = PortableDiBag.createBuilder().withServices({
      raw: PortableDiBag.createProvider(() => promise, { factoryReturnKind: 'uninspected' }),
    }).withServiceAlias({ aliasKey: 'rawAlias', targetServiceKey: 'raw' }).buildContainer();
    assertAlias(portable.resolve('rawAlias') === promise, 'raw alias required automatic classification or changed identity');
    await portable.close();
  }
`;
