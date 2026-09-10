/** Shared by actual packed Node/Bun CommonJS/ESM consumers from both emitters. */
export const selectedScopeRuntimeAssertions = `
  {
    const assertSelected = (condition, message) => { if (!condition) throw new Error(message); };
    const selectedLog = [];
    const selectedKey = Symbol('selected');
    const selectedToken = DiBag.token(selectedKey).of();
    let settleSelected;
    const selectedPromise = new Promise(resolve => { settleSelected = resolve; });
    const selectedFeature = DiBag.createModuleBuilder().register({
      privateResource: DiBag.withDisposal(({ config }) => ({ id: config.id }), () => { selectedLog.push('private'); }),
      publicResource: DiBag.withDisposal(({ privateResource }) => ({ privateResource }), () => { selectedLog.push('export'); }),
    }).buildModule(['publicResource']).renameExport('publicResource', 'shared');
    const selectedRoot = DiBag.createBuilder().installModule(selectedFeature).register(selectedToken, () => ({ id: 'parent' })).register({
      config: () => ({ id: 'parent' }),
      pending: DiBag.withDisposal(() => selectedPromise, () => { selectedLog.push('pending'); }),
      raw: DiBag.fromFactory(() => selectedPromise, { acquisitionMode: 'raw' }),
      rooted: DiBag.withLifetime(DiBag.withDisposal(({ config }) => ({ id: config.id }), () => { selectedLog.push('root'); }), 'root', { allowScopedDependencies: true }),
    }).build();
    const selectedChild = selectedRoot.createScope(['config', selectedToken], {
      config: () => ({ id: 'child' }), [selectedKey]: () => ({ id: 'child' }),
    }, { share: ['shared', 'pending', 'raw'] });
    const selectedGrandchild = selectedChild.createScope({ share: ['shared', selectedToken] });
    assertSelected(selectedChild.resolve('config').id === 'child', 'child override missing');
    assertSelected(selectedGrandchild.resolve(selectedToken).id === 'child', 'token share lost override');
    assertSelected(selectedChild.resolve('shared').privateResource.id === 'parent', 'shared private dependency used child graph');
    assertSelected(selectedGrandchild.resolve('shared') === selectedRoot.resolve('shared'), 'nested shared identity lost');
    assertSelected(selectedChild.resolve('pending') === selectedPromise && selectedRoot.resolve('pending') === selectedPromise, 'shared pending identity lost');
    assertSelected(selectedChild.resolve('raw') === selectedPromise, 'raw identity lost');
    assertSelected(selectedChild.resolve('rooted').id === 'parent', 'inherited root used child context');
    const anchored = selectedChild.createScope(['rooted'], {
      rooted: DiBag.withLifetime(DiBag.withDisposal(({ config }) => ({ id: config.id }), () => { selectedLog.push('anchored'); }), 'root', { allowScopedDependencies: true }),
    });
    const anchoredGrandchild = anchored.createScope(['config'], { config: () => ({ id: 'grandchild' }) });
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
