/** Actual archive assertions for queued canonical lifecycle observations. */
export const observerRuntimeAssertions = `
  {
    const assertObserver = (condition, message) => { if (!condition) throw new Error(message); };
    const turn = () => new Promise(resolve => setTimeout(resolve, 0));
    const events = [];
    const errors = [];
    const observed = DiBag.withConfiguration({ lifecycleObservers: [{ onLifecycleEvent: event => { events.push(event); }, onObserverFailure: failure => { errors.push(failure); } }] });
    const itemKey = Symbol('observed contribution');
    const item = DiBag.createToken(itemKey).forCollectionOf();
    let rootCalls = 0;
    let transientCalls = 0;
    let disposed = 0;
    let finishFinal;
    const finalGate = new Promise(resolve => { finishFinal = resolve; });
    const parent = observed.createBuilder().withServices({
      resource: observed.providerWithRegistrationMetadata({ provider: observed.providerWithLifetime({ provider: observed.providerWithDisposal({ provider: observed.createProvider(() => ({ id: ++rootCalls }), { factoryReturnKind: 'uninspected' }), disposeService: () => { disposed++; } }), lifetime: 'singleton:one-per-container-tree' }), registrationMetadata: { tag: 'root' } }),
      pending: observed.providerWithDisposal({ provider: observed.providerWithTransformedService({ provider: observed.createProvider(() => Promise.resolve(1), { factoryReturnKind: 'native-promise' }), transformService: () => finalGate, callbackReceives: 'fulfilled-value' }), disposeService: value => { assertObserver(value === 42, 'observer changed native disposer payload'); disposed++; } }),
    }).withServiceAlias({ aliasKey: 'resourceAlias', targetServiceKey: 'resource' }).withCollectionContribution({ collectionToken: item, provider: observed.providerWithLifetime({ provider: observed.providerWithDisposal({ provider: observed.createProvider(() => ({ id: ++transientCalls }), { factoryReturnKind: 'uninspected' }), disposeService: () => { disposed++; } }), lifetime: 'transient:one-per-resolve' }) }).buildContainer();
    const child = parent.createChildContainer({ sharedParentServiceKeys: ['resourceAlias'] });
    const borrowed = child.resolve('resourceAlias');
    assertObserver(borrowed === parent.resolve('resource') && rootCalls === 1, 'observer changed canonical alias ownership');
    const rootAttempt = parent.serviceSnapshot('resource').acquisitions[0].acquisitionId;
    child.resolveCollection(item);
    child.resolveCollection(item);
    const contributionAttempts = child.serviceSnapshot(item)[0].acquisitions.map(attempt => attempt.acquisitionId);
    const independent = parent.createIndependentContainer();
    const independentValue = independent.resolve('resourceAlias');
    const independentAttempt = independent.serviceSnapshot('resource').acquisitions[0].acquisitionId;
    assertObserver(independentValue !== borrowed && rootCalls === 2, 'observer changed independent fork ownership');
    const pending = parent.resolve('pending');
    const pendingAttempt = parent.serviceSnapshot('pending').acquisitions[0].acquisitionId;
    assertObserver(parent.resolve('pending') === pending, 'observer wrapped an exposed Promise');
    assertObserver(events.length === 0, 'observer delivery entered synchronous factory execution');
    await turn();
    assertObserver(!events.some(event => event.kind === 'acquisition-ready' && event.acquisitionId === pendingAttempt),
      'observer announced source settlement as final-stage readiness');
    const rootStart = events.find(event => event.kind === 'acquisition-started' && event.acquisitionId === rootAttempt);
    const forkStart = events.find(event => event.kind === 'acquisition-started' && event.acquisitionId === independentAttempt);
    const childStart = events.find(event => event.kind === 'acquisition-started' && contributionAttempts.includes(event.acquisitionId));
    const childOpen = events.find(event => event.kind === 'container-opened' && event.containerId === childStart.containerId);
    const forkOpen = events.find(event => event.kind === 'container-opened' && event.containerId === forkStart.containerId);
    assertObserver(rootStart.registrationMetadata.tag === 'root' && rootStart.lifetime === 'singleton:one-per-container-tree'
      && childOpen.parentContainerId === rootStart.containerId && !Object.hasOwn(forkOpen, 'parentContainerId')
      && forkStart.containerId !== rootStart.containerId, 'observer scope identity or metadata attribution changed');
    assertObserver(events.filter(event => event.kind === 'acquisition-started' && event.acquisitionId === rootAttempt).length === 1
      && events.filter(event => event.kind === 'acquisition-started' && contributionAttempts.includes(event.acquisitionId)).length === 2,
      'observer invented alias attempts or collapsed transient contributions');
    await child.close();
    let parentClosed = false;
    const closing = parent.close().then(() => { parentClosed = true; });
    await turn();
    assertObserver(!parentClosed, 'observer bypassed pending native readiness');
    finishFinal(42);
    await closing;
    assertObserver(independent.resolve('resourceAlias') === independentValue, 'parent observer close captured an independent fork');
    await independent.close();
    await turn();
    assertObserver(disposed === 5 && errors.length === 0, 'observation changed cleanup ownership or produced errors');
    assertObserver(events.filter(event => event.kind === 'acquisition-started').length === 5
      && events.filter(event => event.kind === 'acquisition-ready').length === 5
      && events.filter(event => event.kind === 'disposal-started').length === 5
      && events.filter(event => event.kind === 'disposal-completed' && event.outcome === 'success').length === 5,
      'observer canonical readiness or accepted-cleanup event multiplicity changed');
    assertObserver(events.every(event => Object.isFrozen(event)
      && (!('acquisitionMetadata' in event) || (Object.isFrozen(event.acquisitionMetadata) && event.acquisitionMetadata.every(Object.isFrozen)))
      && (!('registrationMetadata' in event) || Object.isFrozen(event.registrationMetadata))), 'observer snapshots are mutable');

    let privateDisposals = 0;
    const privateFeature = observed.createBuilder().withServices({ hidden: observed.providerWithDisposal({ provider: observed.createProvider(() => ({ owner: 'private' }), { factoryReturnKind: 'uninspected' }), disposeService: () => { privateDisposals++; } }) }).withServiceAlias({ aliasKey: 'visible', targetServiceKey: 'hidden' }).buildModule({ exportedServiceKeys: ['visible'] }).withRenamedExport({ currentExportKey: 'visible', newExportKey: 'publicView' });
    const moduleBag = observed.createBuilder().withInstalledModules([privateFeature]).withServices({
      hidden: observed.createProvider(() => ({ owner: 'host' }), { factoryReturnKind: 'uninspected' }),
    }).buildContainer();
    const privateId = moduleBag.serviceSnapshot('publicView').aliasTarget.bindingId;
    assertObserver(moduleBag.resolve('publicView').owner === 'private', 'observer changed private module alias routing');
    await moduleBag.close();
    await turn();
    assertObserver(privateDisposals === 1
      && events.filter(event => event.kind === 'acquisition-started' && event.bindingId === privateId).length === 1,
      'observer lost canonical private provider identity through rename');

    const cleanupError = new Error('observed cleanup failure');
    const failed = observed.createBuilder().withServices({
      broken: observed.providerWithDisposal({ provider: observed.createProvider(() => 1, { factoryReturnKind: 'uninspected' }), disposeService: () => { throw cleanupError; } }),
    }).buildContainer();
    failed.resolve('broken');
    const brokenAttempt = failed.serviceSnapshot('broken').acquisitions[0].acquisitionId;
    let closeError;
    try { await failed.close(); } catch (error) { closeError = error; }
    await turn();
    const cleanupFailure = events.find(event => event.kind === 'disposal-failed' && event.acquisitionId === brokenAttempt);
    assertObserver(closeError.failures[0].error === cleanupError && cleanupFailure.error === cleanupError
      && Number.isInteger(cleanupFailure.disposalSequence) && cleanupFailure.disposalSequence >= 0
      && events.some(event => event.kind === 'disposal-completed' && event.acquisitionId === brokenAttempt && event.outcome === 'failure')
      && events.some(event => event.kind === 'container-close-failed' && event.error === closeError),
      'observer replaced cleanup failure identity or lost failure completion');

    const thrown = new Error('observer threw');
    const rejected = new Error('observer rejected');
    const thenError = new Error('observer then getter');
    const secondary = new Error('observer error sink rejected');
    const callbackFailures = [];
    const monitored = DiBag.withConfiguration({ lifecycleObservers: [{
      onLifecycleEvent(event) {
        if (event.kind === 'acquisition-started') throw thrown;
        if (event.kind === 'acquisition-ready') return Promise.reject(rejected);
        if (event.kind === 'disposal-started') return Object.defineProperty({}, 'then', { get() { throw thenError; } });
        if (event.kind === 'container-closed') return new Promise(() => {});
      },
      onObserverFailure(failure) { callbackFailures.push(failure); return Promise.reject(secondary); },
    }] }).withConfiguration({ runtime: { isNativePromise: value => value instanceof Promise } });
    let monitoredDisposals = 0;
    const monitoredBag = monitored.createBuilder().withServices({
      value: monitored.providerWithDisposal({ provider: () => ({ id: 'unchanged' }), disposeService: () => { monitoredDisposals++; } }),
    }).buildContainer();
    const monitoredValue = monitoredBag.resolve('value');
    assertObserver(monitoredValue.id === 'unchanged', 'observer result transformed a service');
    await monitoredBag.close();
    await turn();
    assertObserver(monitoredDisposals === 1 && callbackFailures.length === 3
      && callbackFailures.some(failure => failure.error === thrown)
      && callbackFailures.some(failure => failure.error === rejected)
      && callbackFailures.some(failure => failure.error === thenError)
      && callbackFailures.every(failure => Object.isFrozen(failure) && Object.isFrozen(failure.event)),
      'observer failures escaped their sink, recursed, or blocked cleanup');

    let reentrantBag;
    let reentrantRead;
    let reentrantDisposed = 0;
    const reentrantErrors = [];
    const reentrant = DiBag.withConfiguration({ lifecycleObservers: [{
      onLifecycleEvent(event) {
        if (event.kind === 'acquisition-started' && event.bindingLabel === 'trigger') {
          reentrantRead = reentrantBag.resolve('trigger');
          return reentrantBag.close();
        }
      },
      onObserverFailure(failure) { reentrantErrors.push(failure); },
    }] });
    reentrantBag = reentrant.createBuilder().withServices({ trigger: reentrant.providerWithDisposal({
      provider: reentrant.createProvider(() => ({ id: 'reentrant' }), { factoryReturnKind: 'uninspected' }),
      disposeService: () => { reentrantDisposed++; },
    }) }).buildContainer();
    const trigger = reentrantBag.resolve('trigger');
    await turn();
    await reentrantBag.close();
    assertObserver(reentrantRead === trigger && reentrantDisposed === 1 && reentrantErrors.length === 0,
      'queued reentrant observer read/close changed admission or deadlocked');

    const { DiBag: PortableObserverBag } = await import('di-bag');
    const firstEvents = [];
    const secondEvents = [];
    const portableErrors = [];
    const firstFacade = PortableObserverBag.withConfiguration({ lifecycleObservers: [{ onLifecycleEvent: event => { firstEvents.push(event); },
      onObserverFailure: failure => { portableErrors.push(failure); } }] });
    const secondFacade = firstFacade.withConfiguration({ lifecycleObservers: [{ onLifecycleEvent: event => { secondEvents.push(event); },
      onObserverFailure: failure => { portableErrors.push(failure); } }] });
    const raw = new Promise(() => {});
    const firstBag = firstFacade.createBuilder().withServices({ raw: firstFacade.createProvider(() => raw, { factoryReturnKind: 'uninspected' }) }).buildContainer();
    const secondBag = secondFacade.createBuilder().withServices({ raw: secondFacade.createProvider(() => raw, { factoryReturnKind: 'uninspected' }) }).buildContainer();
    assertObserver(firstBag.resolve('raw') === raw && secondBag.resolve('raw') === raw,
      'portable observation added classification capability or awaited a raw value');
    await Promise.all([firstBag.close(), secondBag.close()]);
    await turn();
    assertObserver(firstEvents.filter(event => event.kind === 'acquisition-started').length === 2
      && secondEvents.filter(event => event.kind === 'acquisition-started').length === 1 && portableErrors.length === 0,
      'observed facade mutation or append behavior changed');
  }
`;
