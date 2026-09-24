/** Actual archive assertions for ordered, individually owned contributions. */
export const contributionRuntimeAssertions = `
  {
    const assertContribution = (condition, message) => { if (!condition) throw new Error(message); };
    const itemKey = Symbol('contributed item');
    const item = DiBag.createToken(itemKey).forCollectionOf();
    const singularItem = DiBag.createToken(Symbol('singular item')).forService();
    const empty = DiBag.createBuilder().buildContainer();
    const absent = empty.resolveCollection(item);
    assertContribution(absent.length === 0 && Object.isFrozen(absent), 'empty contribution read changed');
    assertContribution(empty.serviceSnapshot(item).length === 0, 'empty contribution inspection changed');
    await empty.close();

    let privateCalls = 0;
    const privateCleanup = [];
    const feature = DiBag.createBuilder().withServices({
      privateHelper: DiBag.providerWithDisposal({ provider: () => ({ id: ++privateCalls }), disposeService: value => { privateCleanup.push(value.id); } }),
    }).withCollectionContribution({ collectionToken: item, provider: ({ privateHelper }) => privateHelper }).buildModule({ exportedServiceKeys: [] });
    const ordered = DiBag.createBuilder().withCollectionContribution({ collectionToken: item, provider: () => ({ id: 'first' }) }).withInstalledModules([feature]).withCollectionContribution({ collectionToken: item, provider: () => ({ id: 'middle' }) }).withInstalledModules([feature]).withTokenService(singularItem, () => ({ id: 'singular' })).buildContainer();
    const descriptions = ordered.serviceSnapshot(item);
    assertContribution(descriptions.length === 4 && Object.isFrozen(descriptions)
      && descriptions.every(view => Object.isFrozen(view) && view.acquisitions.length === 0)
      && privateCalls === 0, 'collection inspection acquired or exposed mutable state');
    const items = ordered.resolveCollection(item);
    assertContribution(items.map(value => value.id).join(',') === 'first,1,middle,2',
      'host/module/repeated-install contribution ordering changed');
    const again = ordered.resolveCollection(item);
    assertContribution(items !== again && Object.isFrozen(items)
      && items.every((value, index) => value === again[index]), 'collection array or cached item identity changed');
    assertContribution(ordered.resolve(singularItem).id === 'singular', 'singular and collection channels were mixed');
    await ordered.close();
    assertContribution(privateCleanup.length === 2 && new Set(privateCleanup).size === 2,
      'repeated private module contributions lost independent ownership');

    const lifetimeKey = Symbol('lifetime contribution');
    const lifetimeItem = DiBag.createToken(lifetimeKey).forCollectionOf();
    let transientCalls = 0;
    const cleanup = [];
    const lifetimeValues = { root: 'singleton:one-per-container-tree', scoped: 'scoped:one-per-container', transient: 'transient:one-per-resolve' };
    const tracked = (factory, lifetime) => DiBag.providerWithLifetime({ provider: DiBag.providerWithDisposal({ provider: factory, disposeService: value => { cleanup.push(value); } }), lifetime: lifetimeValues[lifetime] });
    const parent = DiBag.createBuilder().withServices({ helper: () => 'parent' }).withCollectionContribution({ collectionToken: lifetimeItem, provider: tracked(() => ({ kind: 'root' }), 'root') }).withCollectionContribution({ collectionToken: lifetimeItem, provider: tracked(({ helper }) => ({ kind: helper }), 'scoped') }).withCollectionContribution({ collectionToken: lifetimeItem, provider: tracked(() => ({ kind: 'transient', id: ++transientCalls }), 'transient') }).withServices({ aggregate: DiBag.createProviderFromFunction({ dependencies: [lifetimeItem], factoryFunction: values => values }) }).buildContainer();
    const child = parent.createChildContainer(['helper'], { helper: () => 'child' }, { sharedParentServiceKeys: ['aggregate'] });
    const borrowed = child.resolve('aggregate');
    assertContribution(borrowed === parent.resolve('aggregate') && borrowed[1].kind === 'parent',
      'shared aggregate escaped its parent contribution graph');
    const local = child.resolveCollection(lifetimeItem);
    const localAgain = child.resolveCollection(lifetimeItem);
    assertContribution(local[0] === borrowed[0] && local[1].kind === 'child'
      && local[1] === localAgain[1] && local[2] !== localAgain[2] && transientCalls === 3,
      'collection lifetime routing or transient multiplicity changed');
    await child.close();
    assertContribution(cleanup.length === 3 && cleanup.includes(local[1])
      && cleanup.includes(local[2]) && cleanup.includes(localAgain[2]), 'child contribution ownership changed');
    await parent.close();
    assertContribution(cleanup.length === 6 && new Set(cleanup).size === 6,
      'shared aggregate introduced duplicate or missing contribution cleanup');

    const promiseKey = Symbol('promise contribution');
    const promiseItem = DiBag.createToken(promiseKey).forCollectionOf();
    let fulfill;
    const native = new Promise(resolve => { fulfill = resolve; });
    // Raw acquisition must not turn even an unresolved Promise into readiness work.
    const raw = new Promise(() => {});
    const fulfilled = { kind: 'native' };
    const promiseCleanup = [];
    const promises = DiBag.createBuilder().withCollectionContribution({ collectionToken: promiseItem, provider: DiBag.providerWithDisposal({ provider: DiBag.createProvider(() => native, { factoryReturnKind: 'native-promise' }), disposeService: value => { promiseCleanup.push(value); } }) }).withCollectionContribution({ collectionToken: promiseItem, provider: DiBag.providerWithDisposal({ provider: DiBag.createProvider(() => raw, { factoryReturnKind: 'uninspected' }), disposeService: value => { promiseCleanup.push(value); } }) }).buildContainer();
    const values = promises.resolveCollection(promiseItem);
    assertContribution(values[0] === native && values[1] === raw, 'collection awaited or wrapped Promise values');
    let closed = false;
    const closing = promises.close().then(() => { closed = true; });
    await new Promise(resolve => setTimeout(resolve, 0));
    assertContribution(!closed && !promiseCleanup.includes(fulfilled), 'close skipped pending contribution readiness');
    fulfill(fulfilled);
    await closing;
    assertContribution(promiseCleanup.length === 2 && promiseCleanup.includes(fulfilled)
      && promiseCleanup.includes(raw), 'collection mode-specific disposal payload changed');

    const retryKey = Symbol('retry contribution');
    const retryItem = DiBag.createToken(retryKey).forCollectionOf();
    const failure = new Error('contribution retry');
    let acceptedCalls = 0;
    let failedCalls = 0;
    let acceptedDisposals = 0;
    const retry = DiBag.createBuilder().withCollectionContribution({ collectionToken: retryItem, provider: DiBag.providerWithDisposal({ provider: () => ({ id: ++acceptedCalls }), disposeService: () => { acceptedDisposals++; } }) }).withCollectionContribution({ collectionToken: retryItem, provider: () => { if (++failedCalls === 1) throw failure; return { id: 'recovered' }; } }).buildContainer();
    let caught;
    try { retry.resolveCollection(retryItem); } catch (error) { caught = error; }
    assertContribution(caught === failure && acceptedCalls === 1 && acceptedDisposals === 0,
      'partial collection failure replaced the error or rolled back accepted ownership');
    const recovered = retry.resolveCollection(retryItem);
    assertContribution(recovered.length === 2 && acceptedCalls === 1 && failedCalls === 2,
      'collection retry reacquired accepted scoped contributions');
    await retry.close();
    assertContribution(acceptedDisposals === 1, 'partial failure lost once-only cleanup');

    const { DiBag: PortableContributionBag } = await import('di-bag');
    const portableKey = Symbol('portable contribution');
    const portableItem = PortableContributionBag.createToken(portableKey).forCollectionOf();
    const portable = PortableContributionBag.createBuilder().withCollectionContribution({ collectionToken: portableItem, provider: PortableContributionBag.createProvider(() => raw, { factoryReturnKind: 'uninspected' }) }).buildContainer();
    assertContribution(portable.resolveCollection(portableItem)[0] === raw,
      'raw collection required automatic classification or changed exposed identity');
    await portable.close();
  }
`;
