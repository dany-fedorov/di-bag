/** Actual archive assertions for validated unknown-plugin providers. */
export const pluginRuntimeAssertions = `
  {
    const assertPlugin = (condition, message) => { if (!condition) throw new Error(message); };
    const turn = () => new Promise(resolve => setTimeout(resolve, 0));

    const value = { run: () => 42 };
    let released = 0;
    const provider = DiBag.fromPlugin([], {
      apiVersion: 1,
      create: () => value,
      dispose(acquired) {
        if (acquired !== value) throw new Error('plugin ownership changed');
        released++;
      },
    }, {
      acquisitionMode: 'raw',
      validate: item => item === value,
    });
    const bag = DiBag.createBuilder().register({ plugin: provider }).build();
    assertPlugin(bag.resolve('plugin') === value, 'plugin identity changed');
    await bag.close();
    assertPlugin(released === 1, 'plugin cleanup was not once-only');

    let creates = 0;
    let descriptorError;
    try {
      DiBag.fromPlugin([], { apiVersion: 2, create: () => { creates++; return value; } }, {
        acquisitionMode: 'raw', validate: item => item === value,
      });
    } catch (error) { descriptorError = error; }
    assertPlugin(descriptorError instanceof DiBagPluginValidationError && descriptorError.phase === 'descriptor' && creates === 0,
      'malformed plugin descriptor ran create or lost its phase');

    const invalid = { id: 'invalid' };
    let invalidReleased = 0;
    let releaseInvalidDisposal;
    const invalidDisposal = new Promise(resolve => { releaseInvalidDisposal = resolve; });
    const invalidProvider = DiBag.fromPlugin([], {
      apiVersion: 1,
      create: () => invalid,
      dispose(acquired) {
        if (acquired !== invalid) throw new Error('invalid plugin ownership changed');
        invalidReleased++;
        return invalidDisposal;
      },
    }, { acquisitionMode: 'raw', validate: () => false });
    const invalidBag = DiBag.createBuilder().register({ invalidPlugin: invalidProvider }).build();
    let outputError;
    try { invalidBag.resolve('invalidPlugin'); } catch (error) { outputError = error; }
    let invalidClosed = false;
    const invalidClose = invalidBag.close().then(() => { invalidClosed = true; });
    await turn();
    assertPlugin(!invalidClosed && invalidReleased === 1,
      'failed plugin validation close skipped pending original-value disposal');
    releaseInvalidDisposal();
    await invalidClose;
    assertPlugin(outputError instanceof DiBagPluginValidationError && outputError.phase === 'output' && invalidReleased === 1,
      'invalid plugin output did not retain original ownership');

    let releaseNative;
    const nativeValue = { id: 'native' };
    const nativeGate = new Promise(resolve => { releaseNative = resolve; });
    let nativeReleased = 0;
    let releaseNativeDisposal;
    const nativeDisposal = new Promise(resolve => { releaseNativeDisposal = resolve; });
    const nativeProvider = DiBag.fromPlugin([], {
      apiVersion: 1,
      create: () => nativeGate,
      dispose(acquired) {
        if (acquired !== nativeValue) throw new Error('native plugin ownership changed');
        nativeReleased++;
        return nativeDisposal;
      },
    }, { acquisitionMode: 'nativePromise', validate: item => item === nativeValue });
    const nativeBag = DiBag.createBuilder().register({ nativePlugin: nativeProvider }).build();
    const nativeResult = nativeBag.resolve('nativePlugin');
    assertPlugin(nativeBag.resolve('nativePlugin') === nativeResult, 'native plugin validation promise was not cached');
    let nativeClosed = false;
    const nativeClose = nativeBag.close().then(() => { nativeClosed = true; });
    await turn();
    assertPlugin(!nativeClosed, 'native plugin close skipped pending validation');
    releaseNative(nativeValue);
    assertPlugin(await nativeResult === nativeValue, 'native plugin validator changed fulfilled identity');
    await turn();
    assertPlugin(!nativeClosed && nativeReleased === 1,
      'native plugin close skipped pending fulfilled-value disposal');
    releaseNativeDisposal();
    await nativeClose;
    assertPlugin(nativeReleased === 1, 'native plugin cleanup was not once-only');

    const requiredKey = Symbol('plugin required');
    const optionalKey = Symbol('plugin optional');
    const lazyKey = Symbol('plugin lazy');
    const allKey = Symbol('plugin all');
    const required = DiBag.token(requiredKey).of();
    const optional = DiBag.token(optionalKey).of();
    const lazy = DiBag.token(lazyKey).of();
    const all = DiBag.token(allKey).of();
    const dependencyProvider = DiBag.fromPlugin([required, DiBag.optional(optional), DiBag.lazy(lazy), DiBag.all(all)], {
      apiVersion: 1,
      create: (requiredValue, optionalValue, getLazy, allValues) => ({
        summary: [requiredValue, optionalValue, getLazy(), allValues.join(',')].join('|'),
      }),
    }, { acquisitionMode: 'raw', validate: item => typeof item === 'object' && item !== null && typeof item.summary === 'string' });
    const dependencyBag = DiBag.createBuilder().register(required, DiBag.fromFactory(() => 3, { acquisitionMode: 'raw' })).register(lazy, DiBag.fromFactory(() => 4, { acquisitionMode: 'raw' })).contribute(all, DiBag.fromFactory(() => 5, { acquisitionMode: 'raw' })).contribute(all, DiBag.fromFactory(() => 6, { acquisitionMode: 'raw' })).register({ dependencyPlugin: dependencyProvider }).build();
    assertPlugin(dependencyBag.resolve('dependencyPlugin').summary === '3||4|5,6',
      'plugin dependencies lost required, optional, lazy or all routing');
    await dependencyBag.close();

    const privateKey = Symbol('plugin private');
    const privateToken = DiBag.token(privateKey).of();
    const privateProvider = DiBag.fromPlugin([privateToken], {
      apiVersion: 1,
      create: secret => ({ secret }),
    }, { acquisitionMode: 'raw', validate: item => typeof item === 'object' && item !== null && item.secret === 17 });
    const privateFeature = DiBag.createBuilder().register(privateToken, DiBag.fromFactory(() => 17, { acquisitionMode: 'raw' })).register({ privatePlugin: privateProvider }).alias('pluginAlias', 'privatePlugin').buildModule(['pluginAlias']).renameExport('pluginAlias', 'publicPlugin');
    const privateBag = DiBag.createBuilder().installModule(privateFeature).build();
    const sharedPlugin = privateBag.resolve('publicPlugin');
    const sharedChild = privateBag.createScope({ share: ['publicPlugin'] });
    assertPlugin(sharedChild.resolve('publicPlugin') === sharedPlugin && sharedPlugin.secret === 17,
      'plugin module alias or selected sharing changed identity');
    await sharedChild.close();
    await privateBag.close();

    const observedEvents = [];
    let releaseObserverWork;
    let observerWorkFinished = false;
    const observerWork = new Promise(resolve => { releaseObserverWork = resolve; }).then(() => { observerWorkFinished = true; });
    let observerWorkStarted = false;
    const observed = DiBag.withConfiguration({ observers: [{
      onEvent: event => {
        observedEvents.push(event);
        if (event.kind === 'acquisition-started') {
          observerWorkStarted = true;
          return observerWork;
        }
      },
      onError: failure => { throw failure.error; },
    }] });
    const observedValue = { id: 'observed' };
    let observedReleased = 0;
    const observedBag = observed.createBuilder().register({ observedPlugin: observed.fromPlugin([], {
      apiVersion: 1,
      create: () => observedValue,
      dispose(acquired) {
        if (acquired !== observedValue) throw new Error('observer plugin ownership changed');
        observedReleased++;
      },
    }, { acquisitionMode: 'raw', validate: item => item === observedValue }) }).build();
    assertPlugin(observedBag.resolve('observedPlugin') === observedValue, 'observer changed plugin value');
    const observedAttempt = observedBag.inspect('observedPlugin').acquisitions[0].acquisitionId;
    const observedBinding = observedBag.inspect('observedPlugin').bindingId;
    await turn();
    let observedClosed = false;
    await observedBag.close().then(() => { observedClosed = true; });
    assertPlugin(observedClosed && observerWorkStarted && !observerWorkFinished,
      'plugin close waited for application-owned observer work');
    releaseObserverWork();
    await observerWork;
    await turn();
    assertPlugin(observedReleased === 1
      && observedEvents.filter(event => event.kind === 'acquisition-started' && event.acquisitionId === observedAttempt && event.bindingId === observedBinding).length === 1
      && observedEvents.filter(event => event.kind === 'cleanup-completed' && event.acquisitionId === observedAttempt && event.bindingId === observedBinding).length === 1,
      'observer did not retain canonical plugin attempt identity');

    const { DiBag: PortablePluginBag } = await import('di-bag');
    const portableValue = { id: 'portable' };
    const portableProvider = PortablePluginBag.fromPlugin([], {
      apiVersion: 1,
      create: () => portableValue,
    }, { acquisitionMode: 'raw', validate: item => item === portableValue });
    const portableBag = PortablePluginBag.createBuilder().register({ portablePlugin: portableProvider }).build();
    assertPlugin(portableBag.resolve('portablePlugin') === portableValue,
      'portable core required a classifier for explicit raw plugin mode');
    await portableBag.close();
  }
`;
