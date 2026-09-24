/** Shared by actual packed Node/Bun CommonJS/ESM consumers from both emitters. */
export const selectedScopeRuntimeAssertions = `
  {
    const assertSelected = (condition, message) => { if (!condition) throw new Error(message); };
    const selectedLog = [];
    const selectedKey = Symbol('selected');
    const selectedToken = DiBag.createToken(selectedKey).forService();
    let settleSelected;
    const selectedPromise = new Promise(resolve => { settleSelected = resolve; });
    const selectedFeature = DiBag.createBuilder().withServices({
      privateResource: DiBag.providerWithLifetime({ provider: DiBag.providerWithDisposal({ provider: ({ config }) => ({ id: config.id }), disposeService: () => { selectedLog.push('private'); } }), lifetime: 'scoped:one-per-container' }),
      publicResource: DiBag.providerWithLifetime({ provider: DiBag.providerWithDisposal({ provider: ({ privateResource }) => ({ privateResource }), disposeService: () => { selectedLog.push('export'); } }), lifetime: 'scoped:one-per-container' }),
    }).buildModule({ exportedServiceKeys: ['publicResource'] }).withRenamedExport({ currentExportKey: 'publicResource', newExportKey: 'shared' });
    const selectedRoot = DiBag.createBuilder().withInstalledModules([selectedFeature]).withTokenService(selectedToken, DiBag.providerWithLifetime({ provider: () => ({ id: 'parent' }), lifetime: 'scoped:one-per-container' })).withServices({
      config: DiBag.providerWithLifetime({ provider: () => ({ id: 'parent' }), lifetime: 'scoped:one-per-container' }),
      pending: DiBag.providerWithLifetime({ provider: DiBag.providerWithDisposal({ provider: () => selectedPromise, disposeService: () => { selectedLog.push('pending'); } }), lifetime: 'scoped:one-per-container' }),
      raw: DiBag.providerWithLifetime({ provider: DiBag.createProvider(() => selectedPromise, { factoryReturnKind: 'uninspected' }), lifetime: 'scoped:one-per-container' }),
      rooted: DiBag.providerWithLifetime({ provider: DiBag.providerWithDisposal({ provider: ({ config }) => ({ id: config.id }), disposeService: () => { selectedLog.push('root'); } }), lifetime: 'singleton:one-per-container-tree', allowsScopedDependencies: true }),
    }).buildContainer();
    const selectedChild = selectedRoot.createChildContainer(['config', selectedToken], {
      config: DiBag.providerWithLifetime({ provider: () => ({ id: 'child' }), lifetime: 'scoped:one-per-container' }), [selectedKey]: DiBag.providerWithLifetime({ provider: () => ({ id: 'child' }), lifetime: 'scoped:one-per-container' }),
    }, { sharedParentServiceKeys: ['shared', 'pending', 'raw'] });
    const selectedGrandchild = selectedChild.createChildContainer({ sharedParentServiceKeys: ['shared', selectedToken] });
    assertSelected(selectedChild.resolve('config').id === 'child', 'child override missing');
    assertSelected(selectedGrandchild.resolve(selectedToken).id === 'child', 'token share lost override');
    assertSelected(selectedChild.resolve('shared').privateResource.id === 'parent', 'shared private dependency used child graph');
    assertSelected(selectedGrandchild.resolve('shared') === selectedRoot.resolve('shared'), 'nested shared identity lost');
    assertSelected(selectedChild.resolve('pending') === selectedPromise && selectedRoot.resolve('pending') === selectedPromise, 'shared pending identity lost');
    assertSelected(selectedChild.resolve('raw') === selectedPromise, 'raw identity lost');
    assertSelected(selectedChild.resolve('rooted').id === 'parent', 'inherited root used child context');
    const anchored = selectedChild.createChildContainer(['rooted'], {
      rooted: DiBag.providerWithLifetime({ provider: DiBag.providerWithDisposal({ provider: ({ config }) => ({ id: config.id }), disposeService: () => { selectedLog.push('anchored'); } }), lifetime: 'singleton:one-per-container-tree', allowsScopedDependencies: true }),
    });
    const anchoredGrandchild = anchored.createChildContainer(['config'], { config: DiBag.providerWithLifetime({ provider: () => ({ id: 'grandchild' }), lifetime: 'scoped:one-per-container' }) });
    assertSelected(anchoredGrandchild.resolve('rooted').id === 'child', 'child root anchor lost');
    assertSelected(anchoredGrandchild.resolve('rooted') === anchored.resolve('rooted'), 'child root identity lost');
    settleSelected(42);
    await selectedChild.close();
    assertSelected(selectedLog.length === 1 && selectedLog[0] === 'anchored', 'borrower disposed ancestor acquisitions');
    await selectedRoot.close();
    assertSelected(selectedLog.length === 5 && new Set(selectedLog).size === 5, 'selected ownership lost or duplicated');
    assertSelected(selectedLog.indexOf('export') < selectedLog.indexOf('private'), 'shared module disposal order changed');
  }
`;
