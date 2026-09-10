/** Actual archive assertions for ordered, individually owned contributions. */
export const contributionRuntimeAssertions = `
  {
    const assertContribution = (condition, message) => { if (!condition) throw new Error(message); };
    const itemKey = Symbol('contributed item');
    const item = DiBag.token(itemKey).of();
    const empty = DiBag.createBuilder().build();
    const absent = empty.resolveAll(item);
    assertContribution(absent.length === 0 && Object.isFrozen(absent), 'empty contribution read changed');
    assertContribution(empty.inspectAll(item).length === 0, 'empty contribution inspection changed');
    await empty.close();

    let privateCalls = 0;
    const privateCleanup = [];
    const feature = DiBag.createBuilder().register({
      privateHelper: DiBag.withDisposal(() => ({ id: ++privateCalls }), value => { privateCleanup.push(value.id); }),
    }).contribute(item, ({ privateHelper }) => privateHelper).buildModule([]);
    const ordered = DiBag.createBuilder().contribute(item, () => ({ id: 'first' })).installModule(feature).contribute(item, () => ({ id: 'middle' })).installModule(feature).register(item, () => ({ id: 'singular' })).build();
    const descriptions = ordered.inspectAll(item);
    assertContribution(descriptions.length === 4 && Object.isFrozen(descriptions)
      && descriptions.every(view => Object.isFrozen(view) && view.acquisitions.length === 0)
      && privateCalls === 0, 'collection inspection acquired or exposed mutable state');
    const items = ordered.resolveAll(item);
    assertContribution(items.map(value => value.id).join(',') === 'first,1,middle,2',
      'host/module/repeated-install contribution ordering changed');
    const again = ordered.resolveAll(item);
    assertContribution(items !== again && Object.isFrozen(items)
      && items.every((value, index) => value === again[index]), 'collection array or cached item identity changed');
    assertContribution(ordered.resolve(item).id === 'singular', 'singular and collection channels were mixed');
    await ordered.close();
    assertContribution(privateCleanup.length === 2 && new Set(privateCleanup).size === 2,
      'repeated private module contributions lost independent ownership');

    const lifetimeKey = Symbol('lifetime contribution');
    const lifetimeItem = DiBag.token(lifetimeKey).of();
    let transientCalls = 0;
    const cleanup = [];
    const tracked = (factory, lifetime) => DiBag.withLifetime(
      DiBag.withDisposal(factory, value => { cleanup.push(value); }), lifetime);
    const parent = DiBag.createBuilder().register({ helper: () => 'parent' }).contribute(lifetimeItem, tracked(() => ({ kind: 'root' }), 'root')).contribute(lifetimeItem, tracked(({ helper }) => ({ kind: helper }), 'scoped')).contribute(lifetimeItem, tracked(() => ({ kind: 'transient', id: ++transientCalls }), 'transient')).register({ aggregate: DiBag.fromFunction([DiBag.all(lifetimeItem)], values => values) }).build();
    const child = parent.createScope(['helper'], { helper: () => 'child' }, { share: ['aggregate'] });
    const borrowed = child.resolve('aggregate');
    assertContribution(borrowed === parent.resolve('aggregate') && borrowed[1].kind === 'parent',
      'shared aggregate escaped its parent contribution graph');
    const local = child.resolveAll(lifetimeItem);
    const localAgain = child.resolveAll(lifetimeItem);
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
    const promiseItem = DiBag.token(promiseKey).of();
    let fulfill;
    const native = new Promise(resolve => { fulfill = resolve; });
    // Raw acquisition must not turn even an unresolved Promise into readiness work.
    const raw = new Promise(() => {});
    const fulfilled = { kind: 'native' };
    const promiseCleanup = [];
    const promises = DiBag.createBuilder().contribute(promiseItem, DiBag.withDisposal(DiBag.fromFactory(() => native, { acquisitionMode: 'nativePromise' }),
        value => { promiseCleanup.push(value); })).contribute(promiseItem, DiBag.withDisposal(DiBag.fromFactory(() => raw, { acquisitionMode: 'raw' }),
        value => { promiseCleanup.push(value); })).build();
    const values = promises.resolveAll(promiseItem);
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
    const retryItem = DiBag.token(retryKey).of();
    const failure = new Error('contribution retry');
    let acceptedCalls = 0;
    let failedCalls = 0;
    let acceptedDisposals = 0;
    const retry = DiBag.createBuilder().contribute(retryItem, DiBag.withDisposal(() => ({ id: ++acceptedCalls }), () => { acceptedDisposals++; })).contribute(retryItem, () => { if (++failedCalls === 1) throw failure; return { id: 'recovered' }; }).build();
    let caught;
    try { retry.resolveAll(retryItem); } catch (error) { caught = error; }
    assertContribution(caught === failure && acceptedCalls === 1 && acceptedDisposals === 0,
      'partial collection failure replaced the error or rolled back accepted ownership');
    const recovered = retry.resolveAll(retryItem);
    assertContribution(recovered.length === 2 && acceptedCalls === 1 && failedCalls === 2,
      'collection retry reacquired accepted scoped contributions');
    await retry.close();
    assertContribution(acceptedDisposals === 1, 'partial failure lost once-only cleanup');

    const { DiBag: PortableContributionBag } = await import('di-bag');
    const portableKey = Symbol('portable contribution');
    const portableItem = PortableContributionBag.token(portableKey).of();
    const portable = PortableContributionBag.createBuilder().contribute(portableItem, PortableContributionBag.fromFactory(() => raw, { acquisitionMode: 'raw' })).build();
    assertContribution(portable.resolveAll(portableItem)[0] === raw,
      'raw collection required automatic classification or changed exposed identity');
    await portable.close();
  }
`;
