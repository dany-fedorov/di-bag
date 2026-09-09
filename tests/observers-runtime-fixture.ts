/** Actual archive assertions for queued canonical lifecycle observations. */
export const observerRuntimeAssertions = `
  {
    const assertObserver = (condition, message) => { if (!condition) throw new Error(message); };
    const turn = () => new Promise(resolve => setTimeout(resolve, 0));
    const events = [];
    const errors = [];
    const observed = DiBag.observe({ onEvent: event => { events.push(event); }, onError: failure => { errors.push(failure); } });
    const itemKey = Symbol('observed contribution');
    const item = DiBag.token(itemKey).of();
    let rootCalls = 0;
    let transientCalls = 0;
    let disposed = 0;
    let finishFinal;
    const finalGate = new Promise(resolve => { finishFinal = resolve; });
    const parent = observed.begin().add({
      resource: observed.withMetadata(observed.withLifetime(observed.withDisposal(
        observed.factory(() => ({ id: ++rootCalls }), { acquisition: 'raw' }), () => { disposed++; }), 'root'),
        { tag: 'root' }),
      pending: observed.withDisposal(observed.mapAsync(
        observed.factory(() => Promise.resolve(1), { acquisition: 'native' }), () => finalGate),
        value => { assertObserver(value === 42, 'observer changed native disposer payload'); disposed++; }),
    }).alias('resourceAlias', 'resource')
      .contribute(item, observed.withLifetime(observed.withDisposal(
        observed.factory(() => ({ id: ++transientCalls }), { acquisition: 'raw' }), () => { disposed++; }), 'transient'))
      .end();
    const child = parent.scope({ share: ['resourceAlias'] });
    const borrowed = child.resolve('resourceAlias');
    assertObserver(borrowed === parent.resolve('resource') && rootCalls === 1, 'observer changed canonical alias ownership');
    const rootAttempt = parent.inspect('resource').acquisitions[0].acquisitionId;
    child.resolveAll(item);
    child.resolveAll(item);
    const contributionAttempts = child.inspectAll(item)[0].acquisitions.map(attempt => attempt.acquisitionId);
    const independent = parent.fork();
    const independentValue = independent.resolve('resourceAlias');
    const independentAttempt = independent.inspect('resource').acquisitions[0].acquisitionId;
    assertObserver(independentValue !== borrowed && rootCalls === 2, 'observer changed independent fork ownership');
    const pending = parent.resolve('pending');
    const pendingAttempt = parent.inspect('pending').acquisitions[0].acquisitionId;
    assertObserver(parent.resolve('pending') === pending, 'observer wrapped an exposed Promise');
    assertObserver(events.length === 0, 'observer delivery entered synchronous factory execution');
    await turn();
    assertObserver(!events.some(event => event.kind === 'acquisition-ready' && event.acquisitionId === pendingAttempt),
      'observer announced source settlement as final-stage readiness');
    const rootStart = events.find(event => event.kind === 'acquisition-started' && event.acquisitionId === rootAttempt);
    const forkStart = events.find(event => event.kind === 'acquisition-started' && event.acquisitionId === independentAttempt);
    const childStart = events.find(event => event.kind === 'acquisition-started' && contributionAttempts.includes(event.acquisitionId));
    const childOpen = events.find(event => event.kind === 'scope-opened' && event.scopeId === childStart.scopeId);
    const forkOpen = events.find(event => event.kind === 'scope-opened' && event.scopeId === forkStart.scopeId);
    assertObserver(rootStart.metadata.tag === 'root' && rootStart.lifetime === 'root'
      && childOpen.parentScopeId === rootStart.scopeId && !Object.hasOwn(forkOpen, 'parentScopeId')
      && forkStart.scopeId !== rootStart.scopeId, 'observer scope identity or metadata attribution changed');
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
      && events.filter(event => event.kind === 'cleanup-started').length === 5
      && events.filter(event => event.kind === 'cleanup-completed' && event.outcome === 'success').length === 5,
      'observer canonical readiness or accepted-cleanup event multiplicity changed');
    assertObserver(events.every(event => Object.isFrozen(event)
      && (!('frames' in event) || (Object.isFrozen(event.frames) && event.frames.every(Object.isFrozen)))
      && (!('metadata' in event) || Object.isFrozen(event.metadata))), 'observer snapshots are mutable');

    let privateDisposals = 0;
    const privateFeature = observed.module().add({ hidden: observed.withDisposal(
      observed.factory(() => ({ owner: 'private' }), { acquisition: 'raw' }), () => { privateDisposals++; }) })
      .alias('visible', 'hidden').exports(['visible']).rename('visible', 'publicView');
    const moduleBag = observed.begin().install(privateFeature).add({
      hidden: observed.factory(() => ({ owner: 'host' }), { acquisition: 'raw' }),
    }).end();
    const privateId = moduleBag.inspect('publicView').alias.bindingId;
    assertObserver(moduleBag.resolve('publicView').owner === 'private', 'observer changed private module alias routing');
    await moduleBag.close();
    await turn();
    assertObserver(privateDisposals === 1
      && events.filter(event => event.kind === 'acquisition-started' && event.bindingId === privateId).length === 1,
      'observer lost canonical private provider identity through rename');

    const cleanupError = new Error('observed cleanup failure');
    const failed = observed.begin().add({
      broken: observed.withDisposal(observed.factory(() => 1, { acquisition: 'raw' }), () => { throw cleanupError; }),
    }).end();
    failed.resolve('broken');
    const brokenAttempt = failed.inspect('broken').acquisitions[0].acquisitionId;
    let closeError;
    try { await failed.close(); } catch (error) { closeError = error; }
    await turn();
    const cleanupFailure = events.find(event => event.kind === 'cleanup-failed' && event.acquisitionId === brokenAttempt);
    assertObserver(closeError.failures[0].error === cleanupError && cleanupFailure.error === cleanupError
      && Number.isInteger(cleanupFailure.disposalIndex) && cleanupFailure.disposalIndex >= 0
      && events.some(event => event.kind === 'cleanup-completed' && event.acquisitionId === brokenAttempt && event.outcome === 'failure')
      && events.some(event => event.kind === 'scope-close-failed' && event.error === closeError),
      'observer replaced cleanup failure identity or lost failure completion');

    const thrown = new Error('observer threw');
    const rejected = new Error('observer rejected');
    const thenError = new Error('observer then getter');
    const secondary = new Error('observer error sink rejected');
    const callbackFailures = [];
    const monitored = DiBag.observe({
      onEvent(event) {
        if (event.kind === 'acquisition-started') throw thrown;
        if (event.kind === 'acquisition-ready') return Promise.reject(rejected);
        if (event.kind === 'cleanup-started') return Object.defineProperty({}, 'then', { get() { throw thenError; } });
        if (event.kind === 'scope-closed') return new Promise(() => {});
      },
      onError(failure) { callbackFailures.push(failure); return Promise.reject(secondary); },
    }).configure({ isNativePromise: value => value instanceof Promise });
    let monitoredDisposals = 0;
    const monitoredBag = monitored.begin().add({
      value: monitored.withDisposal(() => ({ id: 'unchanged' }), () => { monitoredDisposals++; }),
    }).end();
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
    const reentrant = DiBag.observe({
      onEvent(event) {
        if (event.kind === 'acquisition-started' && event.label === 'trigger') {
          reentrantRead = reentrantBag.resolve('trigger');
          return reentrantBag.close();
        }
      },
      onError(failure) { reentrantErrors.push(failure); },
    });
    reentrantBag = reentrant.begin().add({ trigger: reentrant.withDisposal(
      reentrant.factory(() => ({ id: 'reentrant' }), { acquisition: 'raw' }), () => { reentrantDisposed++; }) }).end();
    const trigger = reentrantBag.resolve('trigger');
    await turn();
    await reentrantBag.close();
    assertObserver(reentrantRead === trigger && reentrantDisposed === 1 && reentrantErrors.length === 0,
      'queued reentrant observer read/close changed admission or deadlocked');

    const { DiBag: PortableObserverBag } = await import('di-bag');
    const firstEvents = [];
    const secondEvents = [];
    const portableErrors = [];
    const firstFacade = PortableObserverBag.observe({ onEvent: event => { firstEvents.push(event); },
      onError: failure => { portableErrors.push(failure); } });
    const secondFacade = firstFacade.observe({ onEvent: event => { secondEvents.push(event); },
      onError: failure => { portableErrors.push(failure); } });
    const raw = new Promise(() => {});
    const firstBag = firstFacade.begin().add({ raw: firstFacade.factory(() => raw, { acquisition: 'raw' }) }).end();
    const secondBag = secondFacade.begin().add({ raw: secondFacade.factory(() => raw, { acquisition: 'raw' }) }).end();
    assertObserver(firstBag.resolve('raw') === raw && secondBag.resolve('raw') === raw,
      'portable observation added classification capability or awaited a raw value');
    await Promise.all([firstBag.close(), secondBag.close()]);
    await turn();
    assertObserver(firstEvents.filter(event => event.kind === 'acquisition-started').length === 2
      && secondEvents.filter(event => event.kind === 'acquisition-started').length === 1 && portableErrors.length === 0,
      'observed facade mutation or append behavior changed');
  }
`;
