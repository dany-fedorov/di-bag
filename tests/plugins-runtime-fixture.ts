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
      acquisition: 'raw',
      validate: item => item === value,
    });
    const bag = DiBag.begin().add({ plugin: provider }).end();
    assertPlugin(bag.resolve('plugin') === value, 'plugin identity changed');
    await bag.close();
    assertPlugin(released === 1, 'plugin cleanup was not once-only');

    let creates = 0;
    let descriptorError;
    try {
      DiBag.fromPlugin([], { apiVersion: 2, create: () => { creates++; return value; } }, {
        acquisition: 'raw', validate: item => item === value,
      });
    } catch (error) { descriptorError = error; }
    assertPlugin(descriptorError instanceof DiBagPluginError && descriptorError.phase === 'descriptor' && creates === 0,
      'malformed plugin descriptor ran create or lost its phase');

    const invalid = { id: 'invalid' };
    let invalidReleased = 0;
    const invalidProvider = DiBag.fromPlugin([], {
      apiVersion: 1,
      create: () => invalid,
      dispose(acquired) {
        if (acquired !== invalid) throw new Error('invalid plugin ownership changed');
        invalidReleased++;
      },
    }, { acquisition: 'raw', validate: () => false });
    const invalidBag = DiBag.begin().add({ invalidPlugin: invalidProvider }).end();
    let outputError;
    try { invalidBag.resolve('invalidPlugin'); } catch (error) { outputError = error; }
    await invalidBag.close();
    assertPlugin(outputError instanceof DiBagPluginError && outputError.phase === 'output' && invalidReleased === 1,
      'invalid plugin output did not retain original ownership');

    let releaseNative;
    const nativeValue = { id: 'native' };
    const nativeGate = new Promise(resolve => { releaseNative = resolve; });
    let nativeReleased = 0;
    const nativeProvider = DiBag.fromPlugin([], {
      apiVersion: 1,
      create: () => nativeGate,
      dispose(acquired) {
        if (acquired !== nativeValue) throw new Error('native plugin ownership changed');
        nativeReleased++;
      },
    }, { acquisition: 'native', validate: item => item === nativeValue });
    const nativeBag = DiBag.begin().add({ nativePlugin: nativeProvider }).end();
    const nativeResult = nativeBag.resolve('nativePlugin');
    assertPlugin(nativeBag.resolve('nativePlugin') === nativeResult, 'native plugin validation promise was not cached');
    let nativeClosed = false;
    const nativeClose = nativeBag.close().then(() => { nativeClosed = true; });
    await turn();
    assertPlugin(!nativeClosed, 'native plugin close skipped pending validation');
    releaseNative(nativeValue);
    assertPlugin(await nativeResult === nativeValue, 'native plugin validator changed fulfilled identity');
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
    }, { acquisition: 'raw', validate: item => typeof item === 'object' && item !== null && typeof item.summary === 'string' });
    const dependencyBag = DiBag.begin()
      .bind(required, DiBag.factory(() => 3, { acquisition: 'raw' }))
      .bind(lazy, DiBag.factory(() => 4, { acquisition: 'raw' }))
      .contribute(all, DiBag.factory(() => 5, { acquisition: 'raw' }))
      .contribute(all, DiBag.factory(() => 6, { acquisition: 'raw' }))
      .add({ dependencyPlugin: dependencyProvider }).end();
    assertPlugin(dependencyBag.resolve('dependencyPlugin').summary === '3||4|5,6',
      'plugin dependencies lost required, optional, lazy or all routing');
    await dependencyBag.close();

    const privateKey = Symbol('plugin private');
    const privateToken = DiBag.token(privateKey).of();
    const privateProvider = DiBag.fromPlugin([privateToken], {
      apiVersion: 1,
      create: secret => ({ secret }),
    }, { acquisition: 'raw', validate: item => typeof item === 'object' && item !== null && item.secret === 17 });
    const privateFeature = DiBag.module().bind(privateToken, DiBag.factory(() => 17, { acquisition: 'raw' }))
      .add({ privatePlugin: privateProvider }).alias('pluginAlias', 'privatePlugin')
      .exports(['pluginAlias']).rename('pluginAlias', 'publicPlugin');
    const privateBag = DiBag.begin().install(privateFeature).end();
    const sharedPlugin = privateBag.resolve('publicPlugin');
    const sharedChild = privateBag.scope({ share: ['publicPlugin'] });
    assertPlugin(sharedChild.resolve('publicPlugin') === sharedPlugin && sharedPlugin.secret === 17,
      'plugin module alias or selected sharing changed identity');
    await sharedChild.close();
    await privateBag.close();

    const observedEvents = [];
    const observed = DiBag.observe({ onEvent: event => { observedEvents.push(event); }, onError: failure => { throw failure.error; } });
    const observedValue = { id: 'observed' };
    let observedReleased = 0;
    const observedBag = observed.begin().add({ observedPlugin: observed.fromPlugin([], {
      apiVersion: 1,
      create: () => observedValue,
      dispose(acquired) {
        if (acquired !== observedValue) throw new Error('observer plugin ownership changed');
        observedReleased++;
      },
    }, { acquisition: 'raw', validate: item => item === observedValue }) }).end();
    assertPlugin(observedBag.resolve('observedPlugin') === observedValue, 'observer changed plugin value');
    const observedAttempt = observedBag.inspect('observedPlugin').acquisitions[0].acquisitionId;
    const observedBinding = observedBag.inspect('observedPlugin').bindingId;
    await observedBag.close();
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
    }, { acquisition: 'raw', validate: item => item === portableValue });
    const portableBag = PortablePluginBag.begin().add({ portablePlugin: portableProvider }).end();
    assertPlugin(portableBag.resolve('portablePlugin') === portableValue,
      'portable core required a classifier for explicit raw plugin mode');
    await portableBag.close();
  }
`;
