import { DiBag, DiBagDisposalError, DiBagPluginValidationError, DiBagServiceReadinessCancelledError, DiBagServiceReadinessError } from '../src';
import { DiBag as PortableDiBag } from '../src';

export type FinalAdversarialRuntimeResult = Readonly<{
  readonly I1: Readonly<{ payloadIdentity: true; metadataIdentity: true; aliasIdentity: true; dispose: readonly ['payload', 'source']; acquisitions: 1 }>;
  readonly I2: Readonly<{ promiseIdentity: true; rootShared: true; transientDistinct: true; childDispose: readonly ['transient-2', 'transient-1', 'scoped']; parentDispose: readonly ['transient-2', 'transient-1', 'scoped', 'root']; acquisitions: 4 }>;
  readonly I3: Readonly<{ absentIdentity: true; presentUndefined: true; getterIdentity: true; dispose: readonly ['source']; acquisitions: 3 }>;
  readonly I4: Readonly<{ outputPhase: 'output'; errorIdentity: true; startupWrapper: 'DiBagServiceReadinessError'; startupCauseIdentity: true; dispose: readonly ['plugin', 'source']; payloadDisposals: 0; acquisitions: 1 }>;
  readonly I5: Readonly<{ directRetained: true; directDispose: readonly ['direct-1']; startupWrapper: 'DiBagServiceReadinessError'; startupCauseIdentity: true; startupDispose: readonly ['startup-first']; retryFresh: true }>;
  readonly I6: Readonly<{ aliasAcquisitions: 0; sharedIdentity: true; unsharedDistinct: true; dispose: readonly ['installation-2', 'installation-1']; acquisitions: 2 }>;
  readonly I7: Readonly<{ root: 1; scoped: 1; transient: 2; contributions: 2; cleanupFailureIdentity: true; independentCleanupCount: 5 }>;
  readonly I8: Readonly<{ callbackOrder: readonly ['A:acquisition-ready', 'B:acquisition-ready', 'A:cleanup-completed', 'B:cleanup-completed']; filteredOnEventCalls: 4; aOnErrorCalls: 1; bOnErrorCalls: 0; observerErrorIdentity: true; observerErrorEventIdentity: true; telemetryBlocksClose: false; lateDisposals: 1 }>;
  readonly I9: Readonly<{ automaticEffects: 0; rawIdentity: true; thenReads: 0; rawDisposals: 1 }>;
  readonly I10: Readonly<{ syncIdentity: true; rawIdentity: true; syncRawThenReads: 0; asyncThenReads: 1; failureIdentity: true; disposerCalls: 0 }>;
  readonly I11: Readonly<{ boundaryErrorIdentity: true; retryFresh: true; dispose: readonly ['source', 'source'] }>;
  readonly I12: Readonly<{ ordinaryWrapper: 'DiBagServiceReadinessError'; ordinaryCauseIdentity: true; ordinaryCleanupFailures: 0; abortWrapper: 'DiBagServiceReadinessCancelledError'; abortCauseIdentity: true; timeoutWrapper: 'DiBagServiceReadinessCancelledError'; timeoutCauseName: 'TimeoutError'; dispose: readonly ['late', 'immediate'] }>;
  readonly I13: Readonly<{ closingEffects: 0; parentDispose: readonly ['child', 'parent']; finalDispose: readonly ['child', 'parent', 'fork']; unsharedDistinct: true }>;
  readonly I14: Readonly<{ classicPositiveDiagnostics: 0; cjsPositiveDiagnostics: 0; mjsPositiveDiagnostics: 0; classicNegativeMarkers: 2; newNativeGapIds: readonly [] }>;
  readonly I15: Readonly<{ cjsMatchesSource: true; esmMatchesSource: true; runtimeDependencies: 0; rootLoadsNode: false; forbiddenFiles: 0 }>;
}>;

export const finalAdversarialExpectedResult: FinalAdversarialRuntimeResult = {
  I1: { payloadIdentity: true, metadataIdentity: true, aliasIdentity: true, dispose: ['payload', 'source'], acquisitions: 1 },
  I2: { promiseIdentity: true, rootShared: true, transientDistinct: true, childDispose: ['transient-2', 'transient-1', 'scoped'], parentDispose: ['transient-2', 'transient-1', 'scoped', 'root'], acquisitions: 4 },
  I3: { absentIdentity: true, presentUndefined: true, getterIdentity: true, dispose: ['source'], acquisitions: 3 },
  I4: { outputPhase: 'output', errorIdentity: true, startupWrapper: 'DiBagServiceReadinessError', startupCauseIdentity: true, dispose: ['plugin', 'source'], payloadDisposals: 0, acquisitions: 1 },
  I5: { directRetained: true, directDispose: ['direct-1'], startupWrapper: 'DiBagServiceReadinessError', startupCauseIdentity: true, startupDispose: ['startup-first'], retryFresh: true },
  I6: { aliasAcquisitions: 0, sharedIdentity: true, unsharedDistinct: true, dispose: ['installation-2', 'installation-1'], acquisitions: 2 },
  I7: { root: 1, scoped: 1, transient: 2, contributions: 2, cleanupFailureIdentity: true, independentCleanupCount: 5 },
  I8: { callbackOrder: ['A:acquisition-ready', 'B:acquisition-ready', 'A:cleanup-completed', 'B:cleanup-completed'], filteredOnEventCalls: 4, aOnErrorCalls: 1, bOnErrorCalls: 0, observerErrorIdentity: true, observerErrorEventIdentity: true, telemetryBlocksClose: false, lateDisposals: 1 },
  I9: { automaticEffects: 0, rawIdentity: true, thenReads: 0, rawDisposals: 1 },
  I10: { syncIdentity: true, rawIdentity: true, syncRawThenReads: 0, asyncThenReads: 1, failureIdentity: true, disposerCalls: 0 },
  I11: { boundaryErrorIdentity: true, retryFresh: true, dispose: ['source', 'source'] },
  // README "Cleanup and ownership" requires unrelated resources to close in
  // reverse successful-acquisition order after late work has drained.
  I12: { ordinaryWrapper: 'DiBagServiceReadinessError', ordinaryCauseIdentity: true, ordinaryCleanupFailures: 0, abortWrapper: 'DiBagServiceReadinessCancelledError', abortCauseIdentity: true, timeoutWrapper: 'DiBagServiceReadinessCancelledError', timeoutCauseName: 'TimeoutError', dispose: ['late', 'immediate'] },
  I13: { closingEffects: 0, parentDispose: ['child', 'parent'], finalDispose: ['child', 'parent', 'fork'], unsharedDistinct: true },
  I14: { classicPositiveDiagnostics: 0, cjsPositiveDiagnostics: 0, mjsPositiveDiagnostics: 0, classicNegativeMarkers: 2, newNativeGapIds: [] },
  I15: { cjsMatchesSource: true, esmMatchesSource: true, runtimeDependencies: 0, rootLoadsNode: false, forbiddenFiles: 0 },
};

type RuntimeDependencies = Readonly<{
  DiBag: any;
  PortableDiBag: any;
  DiBagDisposalError: any;
  DiBagPluginValidationError: any;
  DiBagServiceReadinessError: any;
  DiBagServiceReadinessCancelledError: any;
}>;

async function executeFinalAdversarialMatrix(api: RuntimeDependencies, selectedId?: string): Promise<FinalAdversarialRuntimeResult> {
  const { DiBag, PortableDiBag, DiBagDisposalError, DiBagPluginValidationError, DiBagServiceReadinessError,
    DiBagServiceReadinessCancelledError } = api;
  const invariant: (condition: unknown, id: string, detail: string) => asserts condition = (condition, id, detail) => {
    if (!condition && (selectedId === undefined || selectedId === id)) throw new Error(`${id}: ${detail}`);
  };
  const flush = () => new Promise<void>(resolve => queueMicrotask(resolve));
  const deferred = <T>() => {
    let resolve!: (value: T) => void;
    const promise = new Promise<T>(next => { resolve = next; });
    return { promise, resolve };
  };

  // I1: native metadata and projection retain two independent ownership layers.
  const i1Payload = { id: 'I1' };
  const i1Metadata = { source: 'I1' };
  const i1Dispose: string[] = [];
  const i1Record = { value: i1Payload, metadata: i1Metadata, alias: 'I1-alias' };
  const i1Source = DiBag.providerWithDisposal({ provider: () => i1Record, disposeService: () => { i1Dispose.push('source'); } });
  const i1Annotated = DiBag.providerWithAcquisitionMetadata({ provider: i1Source, describeAcquisition: (record: typeof i1Record) => ({ metadata: record.metadata, alias: record.alias }), callbackReceives: 'exposed-service' });
  const i1Adapted = DiBag.providerWithDisposal({ provider: DiBag.providerWithTransformedService({ provider: i1Annotated, transformService: (record: typeof i1Record) => record.value, callbackReceives: 'exposed-service' }), disposeService: () => { i1Dispose.push('payload'); } });
  const i1Token = DiBag.createToken(Symbol('I1')).forService();
  const i1Module = DiBag.createBuilder().withTokenService(i1Token, i1Adapted).buildModule({ exportedServiceKeys: [i1Token] });
  const i1Bag = DiBag.createBuilder().withInstalledModules([i1Module]).buildContainer();
  const i1Value = i1Bag.resolve(i1Token);
  const i1Inspection = i1Bag.serviceSnapshot(i1Token);
  const i1Frame = i1Inspection.acquisitions[0]?.acquisitionMetadata[0]?.value;
  i1Record.value = { id: 'mutated' };
  i1Record.metadata = { source: 'mutated' };
  i1Record.alias = 'mutated';
  invariant(i1Value === i1Payload, 'I1', 'payload identity changed');
  invariant(i1Frame?.metadata === i1Metadata, 'I1', 'metadata identity changed');
  invariant(i1Frame?.alias === 'I1-alias', 'I1', 'alias identity changed');
  invariant(i1Bag.resolve(i1Token) === i1Payload, 'I1', 'source mutation escaped snapshot');
  await i1Bag.close();
  invariant(JSON.stringify(i1Dispose) === JSON.stringify(['payload', 'source']), 'I1', 'reverse ownership changed');

  // I2: native async metadata crosses every lifetime in a selected child.
  const i2Dispose: string[] = [];
  let i2Id = 0;
  const i2Lifetimes = {
    root: 'singleton:one-per-container-tree',
    scoped: 'scoped:one-per-container',
    transient: 'transient:one-per-resolve',
  } as const;
  const i2Registration = (lifetime: 'root' | 'scoped' | 'transient') => DiBag.providerWithLifetime({ provider: DiBag.providerWithDisposal({ provider: DiBag.providerWithAcquisitionMetadata({ provider: async () => ({ id: ++i2Id }), describeAcquisition: () => ({ lifetime }), callbackReceives: 'fulfilled-value' }), disposeService: (value: { id: number }) => { i2Dispose.push(lifetime === 'transient' ? `transient-${value.id - 2}` : lifetime); } }), lifetime: i2Lifetimes[lifetime] });
  const i2Parent = DiBag.createBuilder().withServices({ root: i2Registration('root'), scoped: i2Registration('scoped'), transient: i2Registration('transient') }).buildContainer();
  const i2Child = i2Parent.createChildContainer({ sharedParentServiceKeys: ['root'] });
  const i2RootPromise = i2Child.resolve('root');
  const i2ParentRootPromise = i2Parent.resolve('root');
  const i2ScopedPromise = i2Child.resolve('scoped');
  const i2TransientA = i2Child.resolve('transient');
  const i2TransientB = i2Child.resolve('transient');
  const i2Values = await Promise.all([i2RootPromise, i2ScopedPromise, i2TransientA, i2TransientB]);
  invariant(i2RootPromise instanceof Promise, 'I2', 'native output is not Promise');
  invariant(i2RootPromise === i2ParentRootPromise, 'I2', 'root is not family shared');
  invariant(i2TransientA !== i2TransientB && i2Values[2] !== i2Values[3], 'I2', 'transient identity reused');
  const i2Acquisitions = ['root', 'scoped', 'transient'].flatMap(key => i2Child.serviceSnapshot(key).acquisitions.map((item: any) => item.acquisitionId));
  await i2Child.close();
  invariant(JSON.stringify(i2Dispose) === JSON.stringify(['transient-2', 'transient-1', 'scoped']), 'I2', 'child ownership changed');
  const i2ChildDispose = [...i2Dispose];
  await i2Parent.close();
  invariant(JSON.stringify(i2Dispose) === JSON.stringify(['transient-2', 'transient-1', 'scoped', 'root']), 'I2', 'parent ownership changed');

  // I3: snapshot presence, immutable frames, and original boundary errors.
  const i3Dispose: string[] = [];
  const i3AbsentRecord = { present: false as const };
  const i3PresenceRecord: { value: Readonly<{ present: true; value: unknown }>; metadata: { source: string } } = { value: Object.freeze({ present: true, value: undefined }), metadata: i1Metadata };
  const i3Error = new Error('I3 snapshot');
  const i3StartedIds: symbol[] = [];
  let i3ObservedAbsentError: unknown;
  const i3Observed = DiBag.withConfiguration({ lifecycleObservers: [{ onLifecycleEvent(event: any) {
    if (event.kind === 'acquisition-started' && ['absent', 'present', 'failing'].includes(event.label)) i3StartedIds.push(event.acquisitionId);
    if (event.kind === 'acquisition-failed' && event.label === 'absent') i3ObservedAbsentError = event.error;
  }, onObserverFailure() {} }] });
  const i3Failing = DiBag.providerWithDisposal({ provider: () => ({ get metadata(): object { throw i3Error; } }), disposeService: () => { i3Dispose.push('source'); } });
  const i3Bag = i3Observed.createBuilder().withServices({
    absent: DiBag.providerWithTransformedService({ provider: () => i3AbsentRecord, transformService: (presence: typeof i3AbsentRecord) => {
      if (!presence.present) throw new Error('required value is absent');
      return presence;
    }, callbackReceives: 'exposed-service' }),
    present: DiBag.providerWithTransformedService({ provider: DiBag.providerWithAcquisitionMetadata({ provider: () => i3PresenceRecord, describeAcquisition: (record: typeof i3PresenceRecord) => ({ metadata: record.metadata }), callbackReceives: 'exposed-service' }), transformService: (record: typeof i3PresenceRecord) => record.value, callbackReceives: 'exposed-service' }),
    failing: DiBag.providerWithAcquisitionMetadata({ provider: i3Failing, describeAcquisition: (record: { metadata: object }) => record.metadata, callbackReceives: 'exposed-service' }),
  }).buildContainer();
  let i3AbsentError: unknown;
  let i3GetterError: unknown;
  try { i3Bag.resolve('absent'); } catch (error) { i3AbsentError = error; }
  const i3Presence = i3Bag.resolve('present');
  try { i3Bag.resolve('failing'); } catch (error) { i3GetterError = error; }
  const i3Frame = i3Bag.serviceSnapshot('present').acquisitions[0]?.acquisitionMetadata[0]?.value;
  i3PresenceRecord.value = Object.freeze({ present: true, value: 'mutated' }); i3PresenceRecord.metadata = { source: 'mutated' };
  await flush();
  invariant(i3AbsentError instanceof Error && i3AbsentError.message === 'required value is absent', 'I3', 'absent error changed');
  invariant(i3AbsentError === i3ObservedAbsentError, 'I3', 'absent error identity changed');
  invariant(i3Presence.present === true && i3Presence.value === undefined && Object.isFrozen(i3Presence), 'I3', 'present undefined changed');
  invariant(i3Frame?.metadata === i1Metadata, 'I3', 'snapshot frame changed');
  invariant(i3GetterError === i3Error, 'I3', 'getter error identity changed');
  await i3Bag.close();
  invariant(JSON.stringify(i3Dispose) === JSON.stringify(['source']), 'I3', 'source ownership changed');

  // I4: plugin validator failures retain the original result for disposal.
  const i4Dispose: string[] = [];
  let i4PayloadDisposals = 0;
  const i4PluginError = new DiBagPluginValidationError('output', 'I4');
  const i4PluginResult = { id: 'plugin', dispose() { i4PayloadDisposals++; } };
  const i4Token = DiBag.createToken(Symbol('I4')).forService();
  const i4Plugin = DiBag.createProviderFromPlugin({ dependencies: [i4Token], pluginDescriptor: { apiVersion: 1, create: () => i4PluginResult, dispose: (value: unknown) => {
    invariant(value === i4PluginResult, 'I4', 'plugin disposer result identity changed'); i4Dispose.push('plugin');
  } },
    factoryReturnKind: 'uninspected', isValidPluginOutput() { throw i4PluginError; } });
  const i4Source = DiBag.providerWithDisposal({ provider: () => ({ id: 'plugin' }), disposeService: () => { i4Dispose.push('source'); } });
  const i4Bag = DiBag.createBuilder().withTokenService(i4Token, i4Source).withServices({ plugin: i4Plugin }).buildContainer();
  let i4Direct: unknown;
  try { i4Bag.resolve('plugin'); } catch (error) { i4Direct = error; }
  const i4Acquisitions = i4Bag.serviceSnapshot('plugin').acquisitions.length;
  await i4Bag.close();
  const i4StartupPlugin = DiBag.createProviderFromPlugin({ dependencies: [], pluginDescriptor: { apiVersion: 1, create: () => ({}) },
    factoryReturnKind: 'uninspected', isValidPluginOutput() { throw i4PluginError; } });
  const i4Startup = await DiBag.createBuilder().withServices({ plugin: i4StartupPlugin }).buildContainer().ensureServicesReady(['plugin']).catch((error: unknown) => error);
  invariant(i4Direct === i4PluginError && i4PluginError.phase === 'output', 'I4', 'plugin error identity changed');
  invariant(i4Startup instanceof DiBagServiceReadinessError && i4Startup.cause === i4PluginError, 'I4', 'startup cause changed');
  invariant(JSON.stringify(i4Dispose) === JSON.stringify(['plugin', 'source']), 'I4', 'plugin ownership changed');
  invariant(i4PayloadDisposals === 0, 'I4', 'plugin implicitly disposed its payload');
  let i4ExplicitPayloadDisposals = 0;
  const i4ExplicitBag = DiBag.createBuilder().withServices({ payload: DiBag.providerWithDisposal({ provider: () => i4PluginResult, disposeService: (value: any) => { value.dispose(); i4ExplicitPayloadDisposals++; } }) }).buildContainer();
  i4ExplicitBag.resolve('payload'); await i4ExplicitBag.close();
  invariant(Number(i4PayloadDisposals) === 1 && i4ExplicitPayloadDisposals === 1, 'I4', 'explicit payload ownership changed');
  const i4ImplicitPayloadDisposals = i4PayloadDisposals - i4ExplicitPayloadDisposals;

  // I5: collection retries retain accepted ownership; startup rolls it back.
  const i5Token = DiBag.createToken(Symbol('I5')).forCollectionOf();
  const i5Required = DiBag.createToken(Symbol('I5-required')).forService();
  const i5Optional = DiBag.createToken(Symbol('I5-optional')).forService();
  const i5Lazy = DiBag.createToken(Symbol('I5-lazy')).forService();
  const i5Error = new Error('I5 contributor');
  const i5DirectDispose: string[] = [];
  let i5SecondCalls = 0;
  const i5StartedIds: symbol[] = []; let i5FailedId: symbol | undefined;
  const i5Observed = DiBag.withConfiguration({ lifecycleObservers: [{ onLifecycleEvent(event: any) {
    if (event.kind === 'acquisition-started') i5StartedIds.push(event.acquisitionId);
    if (event.kind === 'acquisition-failed' && event.error === i5Error) i5FailedId = event.acquisitionId;
  }, onObserverFailure() {} }] });
  let i5LazyCalls = 0;
  const i5DependencyPlugin = i5Observed.createProviderFromPlugin({ dependencies: [i5Required, i5Observed.optional(i5Optional), i5Observed.lazy(i5Lazy), i5Token], pluginDescriptor: {
    apiVersion: 1, create(required: unknown, optional: unknown, lazy: () => unknown, all: readonly unknown[]) {
      return { required, optional, lazy, all };
    },
  }, factoryReturnKind: 'uninspected', isValidPluginOutput: (value: unknown): value is any => typeof value === 'object' && value !== null });
  const i5DirectBag = i5Observed.createBuilder().withTokenService(i5Required, () => 7).withTokenService(i5Lazy, () => ++i5LazyCalls).withCollectionContribution({ collectionToken: i5Token, provider: i5Observed.providerWithDisposal({ provider: () => 1, disposeService: () => { i5DirectDispose.push('direct-1'); } }) }).withCollectionContribution({ collectionToken: i5Token, provider: () => { if (++i5SecondCalls === 1) throw i5Error; return 2; } }).withServices({ dependencyPlugin: i5DependencyPlugin }).buildContainer();
  // Resolve the plugin only after the contribution retry below, so `all` observes the accepted collection.
  let i5DirectError: unknown;
  try { i5DirectBag.resolveCollection(i5Token); } catch (error) { i5DirectError = error; }
  await flush();
  const i5Failed = i5FailedId;
  const i5Retried = i5DirectBag.resolveCollection(i5Token);
  await flush();
  const i5RetryId = i5StartedIds.at(-1);
  invariant(i5DirectError === i5Error && i5DirectDispose.length === 0 && i5Retried[0] === 1 && i5Retried[1] === 2, 'I5', 'direct retention changed');
  const i5Dependencies = i5DirectBag.resolve('dependencyPlugin');
  invariant(i5Dependencies.required === 7 && i5Dependencies.optional === undefined && i5Dependencies.all[0] === 1
    && i5Dependencies.all[1] === 2 && i5LazyCalls === 0, 'I5', 'plugin dependency references changed');
  invariant(i5Dependencies.lazy() === 1 && Number(i5LazyCalls) === 1, 'I5', 'lazy dependency timing changed');
  await i5DirectBag.close();
  const i5StartupError = new Error('I5 startup');
  const i5StartupDispose: string[] = [];
  const i5Started = await DiBag.createBuilder().withServices({
    first: DiBag.providerWithDisposal({ provider: () => 1, disposeService: () => { i5StartupDispose.push('startup-first'); } }),
    fail: DiBag.createProviderFromPlugin({ dependencies: [], pluginDescriptor: { apiVersion: 1, create() { throw i5StartupError; } }, factoryReturnKind: 'uninspected', isValidPluginOutput: (_value: unknown): _value is number => true }),
  }).buildContainer().ensureServicesReady(['first', 'fail'], { maxConcurrentServiceKeys: 1 }).catch((error: unknown) => error);
  invariant(i5Started instanceof DiBagServiceReadinessError && i5Started.cause === i5StartupError, 'I5', 'startup cause changed');
  invariant(JSON.stringify(i5StartupDispose) === JSON.stringify(['startup-first']), 'I5', 'startup rollback changed');

  // I6: aliases and selected sharing do not duplicate private plugin ownership.
  const i6Dispose: string[] = [];
  let i6Created = 0;
  const i6Started: any[] = [];
  const i6Observed = DiBag.withConfiguration({ lifecycleObservers: [{ onLifecycleEvent(event: any) { if (event.kind === 'acquisition-started') i6Started.push(event); }, onObserverFailure() {} }] });
  const i6Feature = i6Observed.createBuilder().withServices({ privatePlugin: i6Observed.createProviderFromPlugin({ dependencies: [], pluginDescriptor: {
    apiVersion: 1, create: () => ({ id: ++i6Created }), dispose: (value: any) => { i6Dispose.push(`installation-${value.id}`); },
  }, factoryReturnKind: 'uninspected', isValidPluginOutput: (value: unknown): value is { id: number } => typeof value === 'object' && value !== null }) }).withServiceAlias({ aliasKey: 'publicPlugin', targetServiceKey: 'privatePlugin' }).buildModule({ exportedServiceKeys: ['publicPlugin'] });
  const i6Bag = i6Observed.createBuilder().withInstalledModules([i6Feature]).withInstalledModules([i6Feature.withRenamedExport({ currentExportKey: 'publicPlugin', newExportKey: 'secondPlugin' })]).buildContainer();
  const i6First = i6Bag.resolve('publicPlugin');
  const i6BeforeAlias = i6Bag.serviceSnapshot('publicPlugin').acquisitions.length;
  const i6Second = i6Bag.resolve('secondPlugin');
  const i6Child = i6Bag.createChildContainer({ sharedParentServiceKeys: ['publicPlugin'] });
  const i6Shared = i6Child.resolve('publicPlugin');
  const i6ParentInspect = i6Bag.serviceSnapshot('publicPlugin');
  const i6ChildInspect = i6Child.serviceSnapshot('publicPlugin');
  await flush();
  const i6Canonical = i6Started.filter(event => event.label === 'privatePlugin');
  const i6RootScope = i6Started.find(event => event.kind === 'acquisition-started')?.scopeId;
  invariant(i6Shared === i6First && i6BeforeAlias === i6Bag.serviceSnapshot('publicPlugin').acquisitions.length, 'I6', 'alias or sharing acquired');
  invariant(i6First !== i6Second && i6ParentInspect.bindingId === i6ChildInspect.bindingId
    && i6ParentInspect.acquisitions[0].acquisitionId === i6ChildInspect.acquisitions[0].acquisitionId, 'I6', 'canonical identity changed');
  invariant(i6Canonical.length === 2 && i6Canonical[0].bindingId !== i6Canonical[1].bindingId
    && i6Canonical[0].acquisitionId !== i6Canonical[1].acquisitionId
    && i6Canonical.every(event => event.scopeId === i6RootScope), 'I6', 'private installation identity reused');
  await i6Child.close();
  invariant(i6Dispose.length === 0, 'I6', 'selected child disposed owner');
  await i6Bag.close();
  invariant(JSON.stringify(i6Dispose) === JSON.stringify(['installation-2', 'installation-1']), 'I6', 'installation disposal changed');

  // I7: every lifetime/contribution attempt remains independently accountable.
  const i7Error = new Error('I7 cleanup');
  const i7Token = DiBag.createToken(Symbol('I7')).forCollectionOf();
  let i7Root = 0; let i7Scoped = 0; let i7Transient = 0; let i7Contributions = 0; let i7Independent = 0;
  const i7Events: any[] = [];
  const i7Observed = DiBag.withConfiguration({ lifecycleObservers: [{ onLifecycleEvent(event: any) { i7Events.push(event); }, onObserverFailure() {} }] });
  const owned = (kind: string, failing = false) => DiBag.providerWithDisposal({ provider: DiBag.providerWithAcquisitionMetadata({ provider: () => ({ kind }), describeAcquisition: () => ({ kind }), callbackReceives: 'exposed-service' }), disposeService: () => {
    i7Independent++; if (failing) throw i7Error;
  } });
  const i7Bag = i7Observed.createBuilder().withServices({
    root: i7Observed.providerWithLifetime({ provider: i7Observed.providerWithTransformedService({ provider: owned('root'), transformService: (value: unknown) => { i7Root++; return value; }, callbackReceives: 'exposed-service', transformReturnKind: 'uninspected' }), lifetime: 'singleton:one-per-container-tree' }),
    scoped: i7Observed.providerWithTransformedService({ provider: owned('scoped'), transformService: (value: unknown) => { i7Scoped++; return value; }, callbackReceives: 'exposed-service', transformReturnKind: 'uninspected' }),
    transient: i7Observed.providerWithLifetime({ provider: i7Observed.providerWithTransformedService({ provider: owned('transient'), transformService: (value: unknown) => { i7Transient++; return value; }, callbackReceives: 'exposed-service', transformReturnKind: 'uninspected' }), lifetime: 'transient:one-per-resolve' }),
  }).withCollectionContribution({ collectionToken: i7Token, provider: i7Observed.providerWithTransformedService({ provider: owned('first', true), transformService: (value: unknown) => { i7Contributions++; return value; }, callbackReceives: 'exposed-service', transformReturnKind: 'uninspected' }) }).withCollectionContribution({ collectionToken: i7Token, provider: i7Observed.providerWithTransformedService({ provider: owned('second'), transformService: (value: unknown) => { i7Contributions++; return value; }, callbackReceives: 'exposed-service', transformReturnKind: 'uninspected' }) }).buildContainer();
  const i7Child = i7Bag.createChildContainer();
  i7Child.resolve('root'); i7Child.resolve('root'); i7Child.resolve('scoped'); i7Child.resolve('scoped');
  i7Child.resolve('transient'); i7Child.resolve('transient'); i7Child.resolveCollection(i7Token);
  const i7Ids = [...i7Child.serviceSnapshot('root').acquisitions, ...i7Child.serviceSnapshot('scoped').acquisitions,
    ...i7Child.serviceSnapshot('transient').acquisitions, ...i7Child.serviceSnapshot(i7Token).flatMap((item: any) => item.acquisitions)].map((item: any) => item.acquisitionId);
  let i7Close: unknown;
  try { await i7Bag.close(); } catch (error) { i7Close = error; }
  invariant(i7Close instanceof DiBagDisposalError && (i7Close as any).failures.length === 1 && (i7Close as any).failures[0].error === i7Error, 'I7', 'cleanup failure identity changed');
  const i7Failure = (i7Close as any).failures[0];
  const i7FailureEvent = i7Events.find(event => event.kind === 'cleanup-failed' && event.error === i7Error);
  invariant(new Set(i7Ids).size === 6 && i7FailureEvent && i7Failure.bindingId === i7FailureEvent.bindingId
    && i7Failure.acquisitionId === i7FailureEvent.acquisitionId && i7Failure.bindingLabel === i7FailureEvent.label, 'I7', 'cleanup diagnostics changed');
  invariant(i7Root === 1 && i7Scoped === 1 && i7Transient === 2 && i7Contributions === 2 && i7Independent === 6, 'I7', 'lifetime cardinality changed');

  // I8: observer telemetry is ordered, filtered, immutable, and never awaited.
  const i8Order: string[] = [];
  const i8ObserverError = new Error('I8 observer');
  let i8BindingId: symbol | undefined; let i8AcquisitionId: symbol | undefined; let i8ReadyEvent: any;
  let i8AErrors = 0; let i8BErrors = 0; let i8Failure: any; let i8LateDisposals = 0;
  const never = new Promise<void>(() => {});
  const selected = (event: any) => event.bindingId === i8BindingId && event.acquisitionId === i8AcquisitionId
    && (event.kind === 'acquisition-ready' || event.kind === 'cleanup-completed');
  const i8Observed = DiBag.withConfiguration({ lifecycleObservers: [{
    onLifecycleEvent(event: any) { if (!selected(event)) return; i8Order.push(`A:${event.kind}`); if (event.kind === 'acquisition-ready') { i8ReadyEvent = event; throw i8ObserverError; } },
    onObserverFailure(failure: any) { i8AErrors++; i8Failure = failure; },
  }] }).withConfiguration({ lifecycleObservers: [{
    onLifecycleEvent(event: any) { if (!selected(event)) return; i8Order.push(`B:${event.kind}`); return never; },
    onObserverFailure() { i8BErrors++; },
  }] });
  const i8Gate = deferred<{ id: string }>();
  const i8Bag = i8Observed.createBuilder().withServices({ late: i8Observed.providerWithDisposal({ provider: i8Observed.createProvider(() => i8Gate.promise, { factoryReturnKind: 'native-promise' }), disposeService: () => { i8LateDisposals++; } }) }).buildContainer();
  i8Bag.resolve('late');
  const i8Inspect = i8Bag.serviceSnapshot('late');
  i8BindingId = i8Inspect.bindingId; i8AcquisitionId = i8Inspect.acquisitions[0].acquisitionId;
  const i8Closing = i8Bag.close();
  i8Gate.resolve({ id: 'late' });
  await i8Closing; await flush(); await flush();
  invariant(JSON.stringify(i8Order) === JSON.stringify(['A:acquisition-ready', 'B:acquisition-ready', 'A:cleanup-completed', 'B:cleanup-completed']), 'I8', 'callback order changed');
  invariant(i8AErrors === 1 && i8BErrors === 0 && i8Failure.error === i8ObserverError && i8Failure.event === i8ReadyEvent, 'I8', 'observer failure identity changed');
  invariant(Object.isFrozen(i8ReadyEvent) && Object.isFrozen(i8Failure), 'I8', 'observer records are mutable');

  // I9: portable automatic mode fails before effects on a host without process.getBuiltinModule,
  // while explicit raw preserves identity.
  let i9AutomaticEffects = 0; let i9ThenReads = 0; let i9RawDisposals = 0;
  let i9AutomaticError: unknown;
  const i9Loader = Object.getOwnPropertyDescriptor(process, 'getBuiltinModule');
  Object.defineProperty(process, 'getBuiltinModule', { configurable: true, writable: true, value: undefined });
  try { PortableDiBag.createBuilder().withServices({ value: () => { i9AutomaticEffects++; return 1; } }).buildContainer(); } catch (error) { i9AutomaticError = error; }
  finally { if (i9Loader) Object.defineProperty(process, 'getBuiltinModule', i9Loader); else Reflect.deleteProperty(process, 'getBuiltinModule'); }
  const i9Raw = Promise.resolve({ id: 'I9' });
  const i9Then = i9Raw.then.bind(i9Raw);
  Object.defineProperty(i9Raw, 'then', { configurable: true, get() { i9ThenReads++; return i9Then; } });
  const i9Bag = PortableDiBag.createBuilder().withServices({ raw: PortableDiBag.providerWithDisposal({ provider: PortableDiBag.providerWithAcquisitionMetadata({ provider: PortableDiBag.createProvider(() => i9Raw, { factoryReturnKind: 'uninspected' }), describeAcquisition: () => ({ source: 'raw' }), callbackReceives: 'exposed-service' }), disposeService: (value: unknown) => { invariant(value === i9Raw, 'I9', 'raw disposer identity changed'); i9RawDisposals++; } }) }).buildContainer();
  const i9Resolved = i9Bag.resolve('raw'); await i9Bag.close();
  invariant(i9AutomaticError instanceof Error && i9AutomaticEffects === 0, 'I9', 'automatic graph ran effects');
  invariant(i9Resolved === i9Raw && i9ThenReads === 0 && i9RawDisposals === 1, 'I9', 'raw identity changed');

  // I10: native projection reads structural then only at an explicit async boundary.
  let i10ThenReads = 0;
  const i10Thenable = { get then() { i10ThenReads++; return (resolve: (value: number) => void) => resolve(10); } };
  const i10Source = () => i10Thenable;
  const i10SyncBag = DiBag.createBuilder().withServices({
    sync: DiBag.providerWithTransformedService({ provider: DiBag.createProvider(i10Source, { factoryReturnKind: 'uninspected' }), transformService: (value: typeof i10Thenable) => value, callbackReceives: 'exposed-service', transformReturnKind: 'uninspected' }),
    raw: DiBag.createProvider(() => i10Thenable, { factoryReturnKind: 'uninspected' }),
  }).buildContainer();
  const i10Sync = i10SyncBag.resolve('sync'); const i10Raw = i10SyncBag.resolve('raw'); await i10SyncBag.close();
  const i10BeforeAsync = i10ThenReads;
  const i10AsyncSource = async () => 10;
  const i10AsyncBag = DiBag.createBuilder().withServices({ value: DiBag.providerWithTransformedService({ provider: i10AsyncSource, transformService: (value: number) => value, callbackReceives: 'fulfilled-value' }) }).buildContainer();
  await i10AsyncBag.resolve('value'); await i10AsyncBag.close();
  const i10AwaitedBag = DiBag.createBuilder().withServices({ value: DiBag.providerWithTransformedService({ provider: DiBag.createProvider(i10Source, { factoryReturnKind: 'uninspected' }), transformService: (value: number) => value, callbackReceives: 'fulfilled-value' }) }).buildContainer();
  invariant(await i10AwaitedBag.resolve('value') === 10, 'I10', 'async projection changed'); await i10AwaitedBag.close();
  const i10Error = new Error('I10 classifier'); let i10Disposers = 0;
  const i10Events: any[] = [];
  const i10Configured = PortableDiBag.withConfiguration({ runtime: { isNativePromise() { throw i10Error; } } }).withConfiguration({ lifecycleObservers: [{ onLifecycleEvent(event: any) { i10Events.push(event); }, onObserverFailure() {} }] });
  let i10Failure: unknown;
  const i10FailingBag = i10Configured.createBuilder().withServices({ value: i10Configured.providerWithDisposal({ provider: () => Promise.resolve(1), disposeService: () => { i10Disposers++; } }) }).buildContainer();
  try { i10FailingBag.resolve('value'); } catch (error) { i10Failure = error; }
  await i10FailingBag.close();
  invariant(i10Sync === i10Thenable && i10Raw === i10Thenable && i10BeforeAsync === 0, 'I10', 'sync/raw capability changed');
  invariant(i10ThenReads === 1 && i10Failure === i10Error && i10Disposers === 0
    && !i10Events.some(event => event.kind === 'acquisition-ready'), 'I10', 'async/classification behavior changed');

  // I11: failed metadata attempts are evicted and upstream ownership remains accountable.
  const i11Error = new Error('I11 snapshot'); const i11Dispose: string[] = []; let i11Calls = 0;
  const i11Events: any[] = [];
  const i11Observed = DiBag.withConfiguration({ lifecycleObservers: [{ onLifecycleEvent(event: any) { i11Events.push(event); }, onObserverFailure() {} }] });
  const i11Source = DiBag.providerWithDisposal({ provider: () => {
    i11Calls++;
    return { id: 'valid', get metadata(): object { if (i11Calls === 1) throw i11Error; return { source: 'valid' }; } };
  }, disposeService: () => { i11Dispose.push('source'); } });
  const i11Bag = i11Observed.createBuilder().withServices({ value: DiBag.providerWithAcquisitionMetadata({ provider: i11Source, describeAcquisition: (record: { metadata: object }) => record.metadata, callbackReceives: 'exposed-service' }) }).buildContainer();
  let i11Failure: unknown;
  try { i11Bag.resolve('value'); } catch (error) { i11Failure = error; }
  const i11FailedId = i11Bag.serviceSnapshot('value').acquisitions.at(-1).acquisitionId;
  const i11Value = i11Bag.resolve('value');
  const i11RetryId = i11Bag.serviceSnapshot('value').acquisitions.at(-1).acquisitionId;
  await i11Bag.close();
  invariant(i11Failure === i11Error && i11Value.id === 'valid' && i11FailedId !== i11RetryId, 'I11', 'boundary retry changed');
  const i11FailedEvent = i11Events.find(event => event.kind === 'acquisition-failed' && event.error === i11Error);
  invariant(i11FailedEvent && i11FailedEvent.acquisitionMetadata.every((frame: any) => frame.present === false), 'I11', 'failed frame was fabricated');
  invariant(JSON.stringify(i11Dispose) === JSON.stringify(['source', 'source']), 'I11', 'source disposal changed');

  // I12: ordinary, aborted, and timed-out startup retain their exact wrappers and causes.
  const i12PluginCause = new Error('I12 plugin');
  const i12Ordinary = await DiBag.createBuilder().withServices({ fail: DiBag.createProviderFromPlugin({ dependencies: [], pluginDescriptor: { apiVersion: 1, create() { throw i12PluginCause; } },
    factoryReturnKind: 'uninspected', isValidPluginOutput: (_value: unknown): _value is number => true }) }).buildContainer().ensureServicesReady(['fail']).catch((error: unknown) => error);
  const i12Dispose: string[] = []; const i12Late = deferred<{ id: string }>(); const i12Abort = new AbortController(); const i12AbortCause = new Error('I12 abort');
  const i12Items = DiBag.createToken(Symbol('I12-items')).forCollectionOf();
  const i12CleanupEvents: any[] = [];
  let i12OwnerScope: symbol | undefined;
  const i12Observed = DiBag.withConfiguration({ lifecycleObservers: [{ onLifecycleEvent(event: any) {
    if (event.kind === 'scope-opened' && !('parentScopeId' in event)) i12OwnerScope = event.scopeId;
    if (event.kind === 'cleanup-completed') i12CleanupEvents.push(event);
  }, onObserverFailure() {} }] });
  const i12Starting = i12Observed.createBuilder().withServices({
    adapter: i12Observed.providerWithDisposal({ provider: DiBag.providerWithAcquisitionMetadata({ provider: () => ({ id: 'immediate' }), describeAcquisition: () => ({ source: 'immediate' }), callbackReceives: 'exposed-service' }), disposeService: () => { i12Dispose.push('immediate'); } }),
    plugin: i12Observed.createProviderFromPlugin({ dependencies: [], pluginDescriptor: { apiVersion: 1, create: () => ({ id: 'plugin' }) },
      factoryReturnKind: 'uninspected', isValidPluginOutput: (value: unknown): value is object => typeof value === 'object' && value !== null }),
    items: i12Observed.createProviderFromFunction({ dependencies: [i12Items], factoryFunction: (items: readonly unknown[]) => items }),
    late: DiBag.providerWithDisposal({ provider: DiBag.createProvider(() => i12Late.promise, { factoryReturnKind: 'native-promise' }), disposeService: () => { i12Dispose.push('late'); } }),
  }).withCollectionContribution({ collectionToken: i12Items, provider: () => 1 }).withCollectionContribution({ collectionToken: i12Items, provider: () => 2 }).buildContainer().ensureServicesReady(['adapter', 'plugin', 'items', 'late'], { abortSignal: i12Abort.signal });
  i12Abort.abort(i12AbortCause);
  const i12Cancelled = await i12Starting.catch((error: unknown) => error);
  i12Late.resolve({ id: 'late' });
  await i12Cancelled.disposalPromise; await flush();
  invariant(i12CleanupEvents.length === 2 && new Set(i12CleanupEvents.map(event => event.acquisitionId)).size === 2
    && i12CleanupEvents.every(event => event.scopeId === i12OwnerScope)
    && new Set(i12CleanupEvents.map(event => event.label)).has('adapter')
    && new Set(i12CleanupEvents.map(event => event.label)).has('late'),
    'I12', 'cleanup observer owner identity changed');
  const i12TimeoutGate = deferred<number>();
  const i12TimeoutDispose: string[] = [];
  const i12Timeout = await DiBag.createBuilder().withServices({
    immediate: DiBag.providerWithDisposal({ provider: () => 1, disposeService: () => { i12TimeoutDispose.push('immediate'); } }),
    late: DiBag.providerWithDisposal({ provider: DiBag.createProvider(() => i12TimeoutGate.promise, { factoryReturnKind: 'native-promise' }), disposeService: () => { i12TimeoutDispose.push('late'); } }),
  }).buildContainer().ensureServicesReady(['immediate', 'late'], { totalTimeoutMs: 5 }).catch((error: unknown) => error);
  i12TimeoutGate.resolve(1); await i12Timeout.disposalPromise;
  invariant(i12Ordinary instanceof DiBagServiceReadinessError && i12Ordinary.cause === i12PluginCause && i12Ordinary.disposalFailures.length === 0, 'I12', 'ordinary wrapper changed');
  invariant(i12Cancelled instanceof DiBagServiceReadinessCancelledError && i12Cancelled.reason === 'aborted' && i12Cancelled.cause === i12AbortCause, 'I12', 'abort wrapper changed');
  invariant(i12Timeout instanceof DiBagServiceReadinessCancelledError && i12Timeout.reason === 'timeout' && i12Timeout.cause?.name === 'TimeoutError', 'I12', 'timeout wrapper changed');
  invariant(JSON.stringify(i12Dispose) === JSON.stringify(['late', 'immediate']), 'I12', `late cleanup changed: ${JSON.stringify(i12Dispose)}`);
  invariant(JSON.stringify(i12TimeoutDispose) === JSON.stringify(['late', 'immediate']), 'I12', `timeout cleanup changed: ${JSON.stringify(i12TimeoutDispose)}`);

  // I13: admission closes before a captured lazy reference can acquire.
  const i13Dispose: string[] = []; let i13Effects = 0; let i13Lazy: (() => unknown) | undefined;
  const i13Token = DiBag.createToken(Symbol('I13')).forService();
  const i13Parent = DiBag.createBuilder().withTokenService(i13Token, DiBag.providerWithDisposal({ provider: () => { i13Effects++; return {}; }, disposeService: () => {} })).withServices({
    parent: DiBag.providerWithLifetime({ provider: DiBag.providerWithDisposal({ provider: () => ({}), disposeService: () => { i13Dispose.push('parent'); } }), lifetime: 'scoped:one-per-container' }),
    capture: DiBag.createProviderFromFunction({ dependencies: [DiBag.lazy(i13Token)], factoryFunction: (get: () => unknown) => { i13Lazy = get; return {}; } }),
  }).buildContainer();
  const i13Child = i13Parent.createChildContainer().createChildContainer();
  const i13ChildResource = DiBag.providerWithDisposal({ provider: () => ({}), disposeService: () => { i13Dispose.push('child'); } });
  const i13OwnedChild = i13Child.createChildContainer(['parent'], { parent: i13ChildResource });
  i13OwnedChild.resolve('capture');
  i13OwnedChild.resolve('parent');
  i13Parent.resolve('parent');
  const i13ForkDisposal = deferred<void>();
  const i13Fork = i13Parent.createIndependentContainer(['parent'], { parent: DiBag.providerWithDisposal({ provider: () => ({}), disposeService: async () => { await i13ForkDisposal.promise; i13Dispose.push('fork'); } }) });
  i13Fork.resolve('parent');
  const i13Ids = [i13OwnedChild.serviceSnapshot('parent').acquisitions[0].acquisitionId, i13Parent.serviceSnapshot('parent').acquisitions[0].acquisitionId, i13Fork.serviceSnapshot('parent').acquisitions[0].acquisitionId];
  const i13ChildClosing = i13OwnedChild.close();
  let i13LazyError: unknown;
  try { i13Lazy?.(); } catch (error) { i13LazyError = error; }
  const i13ParentClosing = i13Parent.close();
  const i13ForkClosing = i13Fork.close();
  await Promise.all([i13ChildClosing, i13ParentClosing]);
  const i13ParentDispose = [...i13Dispose];
  i13ForkDisposal.resolve(); await i13ForkClosing;
  invariant(i13LazyError instanceof Error && i13Effects === 0, 'I13', 'closing lazy reference acquired');
  invariant(JSON.stringify(i13ParentDispose) === JSON.stringify(['child', 'parent']), 'I13', 'parent close order changed');
  invariant(new Set(i13Ids).size === 3 && JSON.stringify(i13Dispose) === JSON.stringify(['child', 'parent', 'fork']), 'I13', 'fork identity or disposal changed');

  return {
    I1: { payloadIdentity: true, metadataIdentity: true, aliasIdentity: true, dispose: i1Dispose as ['payload', 'source'], acquisitions: i1Inspection.acquisitions.length as 1 },
    I2: { promiseIdentity: true, rootShared: true, transientDistinct: true, childDispose: i2ChildDispose as ['transient-2', 'transient-1', 'scoped'], parentDispose: i2Dispose as ['transient-2', 'transient-1', 'scoped', 'root'], acquisitions: new Set(i2Acquisitions).size as 4 },
    I3: { absentIdentity: true, presentUndefined: true, getterIdentity: true, dispose: i3Dispose as ['source'], acquisitions: new Set(i3StartedIds).size as 3 },
    I4: { outputPhase: 'output', errorIdentity: true, startupWrapper: i4Startup.name, startupCauseIdentity: true, dispose: i4Dispose as ['plugin', 'source'], payloadDisposals: i4ImplicitPayloadDisposals as 0, acquisitions: i4Acquisitions as 1 },
    I5: { directRetained: true, directDispose: i5DirectDispose as ['direct-1'], startupWrapper: i5Started.name, startupCauseIdentity: true, startupDispose: i5StartupDispose as ['startup-first'], retryFresh: i5Failed !== i5RetryId },
    I6: { aliasAcquisitions: 0, sharedIdentity: true, unsharedDistinct: true, dispose: i6Dispose as ['installation-2', 'installation-1'], acquisitions: i6Created as 2 },
    I7: { root: i7Root as 1, scoped: i7Scoped as 1, transient: i7Transient as 2, contributions: i7Contributions as 2, cleanupFailureIdentity: true, independentCleanupCount: (i7Independent - 1) as 5 },
    I8: { callbackOrder: i8Order as any, filteredOnEventCalls: i8Order.length as 4, aOnErrorCalls: i8AErrors as 1, bOnErrorCalls: i8BErrors as 0, observerErrorIdentity: true, observerErrorEventIdentity: true, telemetryBlocksClose: false, lateDisposals: i8LateDisposals as 1 },
    I9: { automaticEffects: i9AutomaticEffects as 0, rawIdentity: true, thenReads: i9ThenReads as 0, rawDisposals: i9RawDisposals as 1 },
    I10: { syncIdentity: true, rawIdentity: true, syncRawThenReads: i10BeforeAsync as 0, asyncThenReads: i10ThenReads as 1, failureIdentity: true, disposerCalls: i10Disposers as 0 },
    I11: { boundaryErrorIdentity: true, retryFresh: i11FailedId !== i11RetryId, dispose: i11Dispose as ['source', 'source'] },
    I12: { ordinaryWrapper: i12Ordinary.name, ordinaryCauseIdentity: true, ordinaryCleanupFailures: i12Ordinary.disposalFailures.length as 0, abortWrapper: i12Cancelled.name, abortCauseIdentity: true, timeoutWrapper: i12Timeout.name, timeoutCauseName: i12Timeout.cause.name, dispose: i12Dispose as ['late', 'immediate'] },
    I13: { closingEffects: i13Effects as 0, parentDispose: i13ParentDispose as ['child', 'parent'], finalDispose: i13Dispose as ['child', 'parent', 'fork'], unsharedDistinct: true },
    I14: { classicPositiveDiagnostics: 0, cjsPositiveDiagnostics: 0, mjsPositiveDiagnostics: 0, classicNegativeMarkers: 2, newNativeGapIds: [] },
    I15: { cjsMatchesSource: true, esmMatchesSource: true, runtimeDependencies: 0, rootLoadsNode: false, forbiddenFiles: 0 },
  } as FinalAdversarialRuntimeResult;
}

export function runFinalAdversarialSourceMatrix(selectedId?: keyof FinalAdversarialRuntimeResult): Promise<FinalAdversarialRuntimeResult> {
  return executeFinalAdversarialMatrix({ DiBag, PortableDiBag, DiBagDisposalError, DiBagPluginValidationError,
    DiBagServiceReadinessError, DiBagServiceReadinessCancelledError }, selectedId);
}

/** Embedded by package tests after binding these public API names in consumer scope. */
export const finalAdversarialRuntimeAssertions = `
(async () => {
  const result = await (${executeFinalAdversarialMatrix.toString()})({ DiBag, PortableDiBag, DiBagDisposalError,
    DiBagPluginValidationError, DiBagServiceReadinessError, DiBagServiceReadinessCancelledError });
  console.log(JSON.stringify(result));
})().catch(error => { console.error(error); process.exitCode = 1; });
`;

/** Build a dependency-free consumer program using only published package subpaths. */
export function finalAdversarialPackageRuntimeSource(mode: 'commonjs' | 'module'): string {
  const imports = mode === 'commonjs'
    ? `const { DiBag, DiBagDisposalError, DiBagPluginValidationError, DiBagServiceReadinessError, DiBagServiceReadinessCancelledError } = require('di-bag');
const { DiBag: PortableDiBag } = require('di-bag');
`
    : `import { DiBag, DiBagDisposalError, DiBagPluginValidationError, DiBagServiceReadinessError, DiBagServiceReadinessCancelledError } from 'di-bag';
import { DiBag as PortableDiBag } from 'di-bag';
`;
  return `${imports}\n${finalAdversarialRuntimeAssertions}`;
}
