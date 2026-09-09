/** Shared by actual packed Node/Bun CommonJS/ESM consumers from both emitters. */
export const selectedScopeRuntimeAssertions = `
  {
    const assertSelected = (condition, message) => { if (!condition) throw new Error(message); };
    const selectedLog = [];
    const selectedKey = Symbol('selected');
    const selectedToken = DiBag.token(selectedKey).of();
    let settleSelected;
    const selectedPromise = new Promise(resolve => { settleSelected = resolve; });
    const selectedFeature = DiBag.module().add({
      privateResource: DiBag.withDisposal(({ config }) => ({ id: config.id }), () => { selectedLog.push('private'); }),
      publicResource: DiBag.withDisposal(({ privateResource }) => ({ privateResource }), () => { selectedLog.push('export'); }),
    }).exports(['publicResource']).rename('publicResource', 'shared');
    const selectedRoot = DiBag.begin().install(selectedFeature).bind(selectedToken, () => ({ id: 'parent' })).add({
      config: () => ({ id: 'parent' }),
      pending: DiBag.withDisposal(() => selectedPromise, () => { selectedLog.push('pending'); }),
      raw: DiBag.factory(() => selectedPromise, { acquisition: 'raw' }),
      rooted: DiBag.withLifetime(DiBag.withDisposal(({ config }) => ({ id: config.id }), () => { selectedLog.push('root'); }), 'root', { captureScoped: true }),
    }).end();
    const selectedChild = selectedRoot.scope(['config', selectedToken], {
      config: () => ({ id: 'child' }), [selectedKey]: () => ({ id: 'child' }),
    }, { share: ['shared', 'pending', 'raw'] });
    const selectedGrandchild = selectedChild.scope({ share: ['shared', selectedToken] });
    assertSelected(selectedChild.resolve('config').id === 'child', 'child override missing');
    assertSelected(selectedGrandchild.resolve(selectedToken).id === 'child', 'token share lost override');
    assertSelected(selectedChild.resolve('shared').privateResource.id === 'parent', 'shared private dependency used child graph');
    assertSelected(selectedGrandchild.resolve('shared') === selectedRoot.resolve('shared'), 'nested shared identity lost');
    assertSelected(selectedChild.resolve('pending') === selectedPromise && selectedRoot.resolve('pending') === selectedPromise, 'shared pending identity lost');
    assertSelected(selectedChild.resolve('raw') === selectedPromise, 'raw identity lost');
    assertSelected(selectedChild.resolve('rooted').id === 'parent', 'inherited root used child context');
    const anchored = selectedChild.scope(['rooted'], {
      rooted: DiBag.withLifetime(DiBag.withDisposal(({ config }) => ({ id: config.id }), () => { selectedLog.push('anchored'); }), 'root', { captureScoped: true }),
    });
    const anchoredGrandchild = anchored.scope(['config'], { config: () => ({ id: 'grandchild' }) });
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
