import { DiBag, DiBagCleanupError, DiBagPluginError, DiBagStartupCancelledError, DiBagStartupError } from '../src/node';
import { DiBag as PortableDiBag } from '../src';
import { fromSasBox } from '../src/sas-box';
import { fromValBox, fromValBoxAsync } from '../src/val-box';
import { SasBox } from '../.related-repos/sas-box/src';
import { ValBox } from '../.related-repos/val-box/src';

export type FinalAdversarialRuntimeResult = Readonly<{
  readonly I1: Readonly<{ payloadIdentity: true; metadataIdentity: true; aliasIdentity: true; dispose: readonly ['payload', 'sas']; acquisitions: 1 }>;
  readonly I2: Readonly<{ nativePromise: true; rootShared: true; transientDistinct: true; childDispose: readonly ['transient-2', 'transient-1', 'scoped']; parentDispose: readonly ['transient-2', 'transient-1', 'scoped', 'root']; acquisitions: 4 }>;
  readonly I3: Readonly<{ absentIdentity: true; presentUndefined: true; getterIdentity: true; dispose: readonly ['source']; acquisitions: 3 }>;
  readonly I4: Readonly<{ outputPhase: 'output'; errorIdentity: true; startupWrapper: 'DiBagStartupError'; startupCauseIdentity: true; dispose: readonly ['plugin', 'sas']; payloadDisposals: 0; acquisitions: 1 }>;
  readonly I5: Readonly<{ directRetained: true; directDispose: readonly ['direct-1']; startupWrapper: 'DiBagStartupError'; startupCauseIdentity: true; startupDispose: readonly ['startup-first']; retryFresh: true }>;
  readonly I6: Readonly<{ aliasAcquisitions: 0; sharedIdentity: true; unsharedDistinct: true; dispose: readonly ['installation-2', 'installation-1']; acquisitions: 2 }>;
  readonly I7: Readonly<{ root: 1; scoped: 1; transient: 2; contributions: 2; cleanupFailureIdentity: true; independentCleanupCount: 5 }>;
  readonly I8: Readonly<{ callbackOrder: readonly ['A:acquisition-ready', 'B:acquisition-ready', 'A:cleanup-completed', 'B:cleanup-completed']; filteredOnEventCalls: 4; aOnErrorCalls: 1; bOnErrorCalls: 0; observerErrorIdentity: true; observerErrorEventIdentity: true; telemetryBlocksClose: false; lateDisposals: 1 }>;
  readonly I9: Readonly<{ automaticEffects: 0; rawIdentity: true; thenReads: 0; rawDisposals: 1 }>;
  readonly I10: Readonly<{ syncIdentity: true; rawIdentity: true; syncRawThenReads: 0; asyncThenReads: 1; failureIdentity: true; disposerCalls: 0 }>;
  readonly I11: Readonly<{ boundaryErrorIdentity: true; retryFresh: true; dispose: readonly ['source', 'source'] }>;
  readonly I12: Readonly<{ ordinaryWrapper: 'DiBagStartupError'; ordinaryCauseIdentity: true; ordinaryCleanupFailures: 0; abortWrapper: 'DiBagStartupCancelledError'; abortCauseIdentity: true; timeoutWrapper: 'DiBagStartupCancelledError'; timeoutCauseName: 'TimeoutError'; dispose: readonly ['immediate', 'late'] }>;
  readonly I13: Readonly<{ closingEffects: 0; parentDispose: readonly ['child', 'parent']; finalDispose: readonly ['child', 'parent', 'fork']; unsharedDistinct: true }>;
  readonly I14: Readonly<{ classicPositiveDiagnostics: 0; cjsPositiveDiagnostics: 0; mjsPositiveDiagnostics: 0; classicNegativeMarkers: 2; newNativeGapIds: readonly [] }>;
  readonly I15: Readonly<{ cjsMatchesSource: true; esmMatchesSource: true; coreHasBoxes: false; rootLoadsNode: false; forbiddenFiles: 0 }>;
}>;

export const finalAdversarialExpectedResult: FinalAdversarialRuntimeResult = {
  I1: { payloadIdentity: true, metadataIdentity: true, aliasIdentity: true, dispose: ['payload', 'sas'], acquisitions: 1 },
  I2: { nativePromise: true, rootShared: true, transientDistinct: true, childDispose: ['transient-2', 'transient-1', 'scoped'], parentDispose: ['transient-2', 'transient-1', 'scoped', 'root'], acquisitions: 4 },
  I3: { absentIdentity: true, presentUndefined: true, getterIdentity: true, dispose: ['source'], acquisitions: 3 },
  I4: { outputPhase: 'output', errorIdentity: true, startupWrapper: 'DiBagStartupError', startupCauseIdentity: true, dispose: ['plugin', 'sas'], payloadDisposals: 0, acquisitions: 1 },
  I5: { directRetained: true, directDispose: ['direct-1'], startupWrapper: 'DiBagStartupError', startupCauseIdentity: true, startupDispose: ['startup-first'], retryFresh: true },
  I6: { aliasAcquisitions: 0, sharedIdentity: true, unsharedDistinct: true, dispose: ['installation-2', 'installation-1'], acquisitions: 2 },
  I7: { root: 1, scoped: 1, transient: 2, contributions: 2, cleanupFailureIdentity: true, independentCleanupCount: 5 },
  I8: { callbackOrder: ['A:acquisition-ready', 'B:acquisition-ready', 'A:cleanup-completed', 'B:cleanup-completed'], filteredOnEventCalls: 4, aOnErrorCalls: 1, bOnErrorCalls: 0, observerErrorIdentity: true, observerErrorEventIdentity: true, telemetryBlocksClose: false, lateDisposals: 1 },
  I9: { automaticEffects: 0, rawIdentity: true, thenReads: 0, rawDisposals: 1 },
  I10: { syncIdentity: true, rawIdentity: true, syncRawThenReads: 0, asyncThenReads: 1, failureIdentity: true, disposerCalls: 0 },
  I11: { boundaryErrorIdentity: true, retryFresh: true, dispose: ['source', 'source'] },
  I12: { ordinaryWrapper: 'DiBagStartupError', ordinaryCauseIdentity: true, ordinaryCleanupFailures: 0, abortWrapper: 'DiBagStartupCancelledError', abortCauseIdentity: true, timeoutWrapper: 'DiBagStartupCancelledError', timeoutCauseName: 'TimeoutError', dispose: ['immediate', 'late'] },
  I13: { closingEffects: 0, parentDispose: ['child', 'parent'], finalDispose: ['child', 'parent', 'fork'], unsharedDistinct: true },
  I14: { classicPositiveDiagnostics: 0, cjsPositiveDiagnostics: 0, mjsPositiveDiagnostics: 0, classicNegativeMarkers: 2, newNativeGapIds: [] },
  I15: { cjsMatchesSource: true, esmMatchesSource: true, coreHasBoxes: false, rootLoadsNode: false, forbiddenFiles: 0 },
};

type RuntimeDependencies = Readonly<{
  DiBag: any;
  PortableDiBag: any;
  DiBagCleanupError: any;
  DiBagPluginError: any;
  DiBagStartupError: any;
  DiBagStartupCancelledError: any;
  fromSasBox: any;
  fromValBox: any;
  fromValBoxAsync: any;
  SasBox: any;
  ValBox: any;
}>;

async function executeFinalAdversarialMatrix(api: RuntimeDependencies, selectedId?: string): Promise<FinalAdversarialRuntimeResult> {
  const { DiBag, PortableDiBag, DiBagCleanupError, DiBagPluginError, DiBagStartupError,
    DiBagStartupCancelledError, fromSasBox, fromValBox, fromValBoxAsync, SasBox, ValBox } = api;
  const invariant: (condition: unknown, id: string, detail: string) => asserts condition = (condition, id, detail) => {
    if (!condition && (selectedId === undefined || selectedId === id)) throw new Error(`${id}: ${detail}`);
  };
  const flush = () => new Promise<void>(resolve => queueMicrotask(resolve));
  const deferred = <T>() => {
    let resolve!: (value: T) => void;
    const promise = new Promise<T>(next => { resolve = next; });
    return { promise, resolve };
  };

  // I1: two ownership layers wrap one real SasBox/ValBox chain.
  const i1Payload = { id: 'I1' };
  const i1Metadata = { source: 'I1' };
  const i1Dispose: string[] = [];
  const i1Box = new ValBox.WithValue.WithMetadata(i1Payload, i1Metadata, 'I1-alias');
  const i1Source = DiBag.withDisposal(() => SasBox.fromValue(i1Box), () => { i1Dispose.push('sas'); });
  const i1Adapted = DiBag.withDisposal(fromValBox(fromSasBox(i1Source, { mode: 'sync' })), () => { i1Dispose.push('payload'); });
  const i1Token = DiBag.token(Symbol('I1')).of();
  const i1Module = DiBag.module().bind(i1Token, i1Adapted).exports([i1Token]);
  const i1Bag = DiBag.begin().install(i1Module).end();
  const i1Value = i1Bag.resolve(i1Token);
  const i1Inspection = i1Bag.inspect(i1Token);
  const i1Frame = i1Inspection.acquisitions[0]?.metadata[0]?.value;
  i1Box.setValue({ id: 'mutated' });
  i1Box.setMetadata({ source: 'mutated' });
  i1Box.alias = 'mutated';
  invariant(i1Value === i1Payload, 'I1', 'payload identity changed');
  invariant(i1Frame?.metadata?.value === i1Metadata, 'I1', 'metadata identity changed');
  invariant(i1Frame?.alias === 'I1-alias', 'I1', 'alias identity changed');
  invariant(i1Bag.resolve(i1Token) === i1Payload, 'I1', 'source mutation escaped snapshot');
  await i1Bag.close();
  invariant(JSON.stringify(i1Dispose) === JSON.stringify(['payload', 'sas']), 'I1', 'reverse ownership changed');

  // I2: native box output crosses every lifetime in a selected child.
  const i2Dispose: string[] = [];
  let i2Id = 0;
  const i2Registration = (lifetime: 'root' | 'scoped' | 'transient') => DiBag.withLifetime(
    DiBag.withDisposal(fromValBoxAsync(fromSasBox(() => SasBox.fromAsync(async () => new ValBox.WithValue({ id: ++i2Id })), { mode: 'sync-first' })),
      (value: { id: number }) => { i2Dispose.push(lifetime === 'transient' ? `transient-${value.id - 2}` : lifetime); }), lifetime);
  const i2Parent = DiBag.begin().add({ root: i2Registration('root'), scoped: i2Registration('scoped'), transient: i2Registration('transient') }).end();
  const i2Child = i2Parent.scope({ share: ['root'] });
  const i2RootPromise = i2Child.resolve('root');
  const i2ParentRootPromise = i2Parent.resolve('root');
  const i2ScopedPromise = i2Child.resolve('scoped');
  const i2TransientA = i2Child.resolve('transient');
  const i2TransientB = i2Child.resolve('transient');
  const i2Values = await Promise.all([i2RootPromise, i2ScopedPromise, i2TransientA, i2TransientB]);
  invariant(i2RootPromise instanceof Promise, 'I2', 'native output is not Promise');
  invariant(i2RootPromise === i2ParentRootPromise, 'I2', 'root is not family shared');
  invariant(i2TransientA !== i2TransientB && i2Values[2] !== i2Values[3], 'I2', 'transient identity reused');
  const i2Acquisitions = ['root', 'scoped', 'transient'].flatMap(key => i2Child.inspect(key).acquisitions.map((item: any) => item.acquisitionId));
  await i2Child.close();
  invariant(JSON.stringify(i2Dispose) === JSON.stringify(['transient-2', 'transient-1', 'scoped']), 'I2', 'child ownership changed');
  const i2ChildDispose = [...i2Dispose];
  await i2Parent.close();
  invariant(JSON.stringify(i2Dispose) === JSON.stringify(['transient-2', 'transient-1', 'scoped', 'root']), 'I2', 'parent ownership changed');

  // I3: snapshot presence, immutable frames, and original boundary errors.
  const i3Dispose: string[] = [];
  const i3AbsentBox = new ValBox.WithMetadata({ source: 'absent' }, '');
  const i3PresenceBox = new ValBox.WithValue.WithMetadata(undefined, i1Metadata, '');
  const i3Error = new Error('I3 snapshot');
  const i3StartedIds: symbol[] = [];
  const i3Observed = DiBag.observe({ onEvent(event: any) {
    if (event.kind === 'acquisition-started' && ['absent', 'present', 'failing'].includes(event.label)) i3StartedIds.push(event.acquisitionId);
  }, onError() {} });
  const i3Failing = DiBag.withDisposal(() => ({ snapshot() { throw i3Error; } }), () => { i3Dispose.push('source'); });
  const i3Bag = i3Observed.begin().add({
    absent: fromValBox(() => i3AbsentBox),
    present: fromValBox(() => i3PresenceBox, { value: 'presence' }),
    failing: fromValBox(i3Failing),
  }).end();
  let i3AbsentError: unknown;
  let i3GetterError: unknown;
  try { i3Bag.resolve('absent'); } catch (error) { i3AbsentError = error; }
  const i3Presence = i3Bag.resolve('present');
  try { i3Bag.resolve('failing'); } catch (error) { i3GetterError = error; }
  const i3Frame = i3Bag.inspect('present').acquisitions[0]?.metadata[0]?.value;
  i3PresenceBox.setValue('mutated'); i3PresenceBox.setMetadata({ source: 'mutated' });
  invariant(i3AbsentError instanceof Error && i3AbsentError.message === 'val-box value is absent', 'I3', 'absent error changed');
  invariant(i3Presence.present === true && i3Presence.value === undefined && Object.isFrozen(i3Presence), 'I3', 'present undefined changed');
  // val-box 0.1.0 treats an empty constructor alias as anonymous, represented by null.
  invariant(i3Frame?.alias === null && i3Frame.metadata.value === i1Metadata, 'I3', 'snapshot frame changed');
  invariant(i3GetterError === i3Error, 'I3', 'getter error identity changed');
  await flush();
  await i3Bag.close();
  invariant(JSON.stringify(i3Dispose) === JSON.stringify(['source']), 'I3', 'source ownership changed');

  // I4: plugin validator failures retain the original result for disposal.
  const i4Dispose: string[] = [];
  let i4PayloadDisposals = 0;
  const i4PluginError = new DiBagPluginError('output', 'I4');
  const i4PluginResult = { id: 'plugin', dispose() { i4PayloadDisposals++; } };
  const i4Token = DiBag.token(Symbol('I4')).of();
  const i4Plugin = DiBag.fromPlugin([i4Token], { apiVersion: 1, create: () => i4PluginResult, dispose: (value: unknown) => {
    invariant(value === i4PluginResult, 'I4', 'plugin disposer result identity changed'); i4Dispose.push('plugin');
  } },
    { acquisition: 'raw', validate() { throw i4PluginError; } });
  const i4Source = DiBag.withDisposal(() => SasBox.fromValue({ id: 'plugin' }), () => { i4Dispose.push('sas'); });
  const i4Bag = DiBag.begin().bind(i4Token, fromSasBox(i4Source, { mode: 'sync' })).add({ plugin: i4Plugin }).end();
  let i4Direct: unknown;
  try { i4Bag.resolve('plugin'); } catch (error) { i4Direct = error; }
  const i4Acquisitions = i4Bag.inspect('plugin').acquisitions.length;
  await i4Bag.close();
  const i4StartupPlugin = DiBag.fromPlugin([], { apiVersion: 1, create: () => ({}) },
    { acquisition: 'raw', validate() { throw i4PluginError; } });
  const i4Startup = await DiBag.begin().add({ plugin: i4StartupPlugin }).start(['plugin']).catch((error: unknown) => error);
  invariant(i4Direct === i4PluginError && i4PluginError.phase === 'output', 'I4', 'plugin error identity changed');
  invariant(i4Startup instanceof DiBagStartupError && i4Startup.cause === i4PluginError, 'I4', 'startup cause changed');
  invariant(JSON.stringify(i4Dispose) === JSON.stringify(['plugin', 'sas']), 'I4', 'plugin ownership changed');
  invariant(i4PayloadDisposals === 0, 'I4', 'plugin implicitly disposed its payload');
  let i4ExplicitPayloadDisposals = 0;
  const i4ExplicitBag = DiBag.begin().add({ payload: DiBag.withDisposal(() => i4PluginResult, (value: any) => { value.dispose(); i4ExplicitPayloadDisposals++; }) }).end();
  i4ExplicitBag.resolve('payload'); await i4ExplicitBag.close();
  invariant(Number(i4PayloadDisposals) === 1 && i4ExplicitPayloadDisposals === 1, 'I4', 'explicit payload ownership changed');
  const i4ImplicitPayloadDisposals = i4PayloadDisposals - i4ExplicitPayloadDisposals;

  // I5: collection retries retain accepted ownership; startup rolls it back.
  const i5Token = DiBag.token(Symbol('I5')).of();
  const i5Required = DiBag.token(Symbol('I5-required')).of();
  const i5Optional = DiBag.token(Symbol('I5-optional')).of();
  const i5Lazy = DiBag.token(Symbol('I5-lazy')).of();
  const i5Error = new Error('I5 contributor');
  const i5DirectDispose: string[] = [];
  let i5SecondCalls = 0;
  const i5StartedIds: symbol[] = []; let i5FailedId: symbol | undefined;
  const i5Observed = DiBag.observe({ onEvent(event: any) {
    if (event.kind === 'acquisition-started') i5StartedIds.push(event.acquisitionId);
    if (event.kind === 'acquisition-failed' && event.error === i5Error) i5FailedId = event.acquisitionId;
  }, onError() {} });
  let i5LazyCalls = 0;
  const i5DependencyPlugin = i5Observed.fromPlugin([i5Required, i5Observed.optional(i5Optional), i5Observed.lazy(i5Lazy), i5Observed.all(i5Token)], {
    apiVersion: 1, create(required: unknown, optional: unknown, lazy: () => unknown, all: readonly unknown[]) {
      return { required, optional, lazy, all };
    },
  }, { acquisition: 'raw', validate: (value: unknown): value is any => typeof value === 'object' && value !== null });
  const i5DirectBag = i5Observed.begin()
    .bind(i5Required, fromValBox(() => new ValBox.WithValue(7)))
    .bind(i5Lazy, fromSasBox(() => SasBox.fromValue(++i5LazyCalls), { mode: 'sync' }))
    .contribute(i5Token, i5Observed.withDisposal(fromValBox(() => new ValBox.WithValue(1)), () => { i5DirectDispose.push('direct-1'); }))
    .contribute(i5Token, () => { if (++i5SecondCalls === 1) throw i5Error; return 2; })
    .add({ dependencyPlugin: i5DependencyPlugin }).end();
  // Resolve the plugin only after the contribution retry below, so `all` observes the accepted collection.
  let i5DirectError: unknown;
  try { i5DirectBag.resolveAll(i5Token); } catch (error) { i5DirectError = error; }
  await flush();
  const i5Failed = i5FailedId;
  const i5Retried = i5DirectBag.resolveAll(i5Token);
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
  const i5Started = await DiBag.begin().add({
    first: DiBag.withDisposal(() => 1, () => { i5StartupDispose.push('startup-first'); }),
    fail: DiBag.fromPlugin([], { apiVersion: 1, create() { throw i5StartupError; } }, { acquisition: 'raw', validate: (_value: unknown): _value is number => true }),
  }).start(['first', 'fail'], { concurrency: 'sequential' }).catch((error: unknown) => error);
  invariant(i5Started instanceof DiBagStartupError && i5Started.cause === i5StartupError, 'I5', 'startup cause changed');
  invariant(JSON.stringify(i5StartupDispose) === JSON.stringify(['startup-first']), 'I5', 'startup rollback changed');

  // I6: aliases and selected sharing do not duplicate private plugin ownership.
  const i6Dispose: string[] = [];
  let i6Created = 0;
  const i6Started: any[] = [];
  const i6Observed = DiBag.observe({ onEvent(event: any) { if (event.kind === 'acquisition-started') i6Started.push(event); }, onError() {} });
  const i6Feature = i6Observed.module().add({ privatePlugin: i6Observed.fromPlugin([], {
    apiVersion: 1, create: () => ({ id: ++i6Created }), dispose: (value: any) => { i6Dispose.push(`installation-${value.id}`); },
  }, { acquisition: 'raw', validate: (value: unknown): value is { id: number } => typeof value === 'object' && value !== null }) })
    .alias('publicPlugin', 'privatePlugin').exports(['publicPlugin']);
  const i6Bag = i6Observed.begin().install(i6Feature).install(i6Feature.rename('publicPlugin', 'secondPlugin')).end();
  const i6First = i6Bag.resolve('publicPlugin');
  const i6BeforeAlias = i6Bag.inspect('publicPlugin').acquisitions.length;
  const i6Second = i6Bag.resolve('secondPlugin');
  const i6Child = i6Bag.scope({ share: ['publicPlugin'] });
  const i6Shared = i6Child.resolve('publicPlugin');
  const i6ParentInspect = i6Bag.inspect('publicPlugin');
  const i6ChildInspect = i6Child.inspect('publicPlugin');
  await flush();
  const i6Canonical = i6Started.filter(event => event.label === 'privatePlugin');
  const i6RootScope = i6Started.find(event => event.kind === 'acquisition-started')?.scopeId;
  invariant(i6Shared === i6First && i6BeforeAlias === i6Bag.inspect('publicPlugin').acquisitions.length, 'I6', 'alias or sharing acquired');
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
  const i7Token = DiBag.token(Symbol('I7')).of();
  let i7Root = 0; let i7Scoped = 0; let i7Transient = 0; let i7Contributions = 0; let i7Independent = 0;
  const i7Events: any[] = [];
  const i7Observed = DiBag.observe({ onEvent(event: any) { i7Events.push(event); }, onError() {} });
  const owned = (kind: string, failing = false) => DiBag.withDisposal(fromValBox(() => new ValBox.WithValue({ kind })), () => {
    i7Independent++; if (failing) throw i7Error;
  });
  const i7Bag = i7Observed.begin().add({
    root: i7Observed.withLifetime(i7Observed.mapSync(owned('root'), (value: unknown) => { i7Root++; return value; }, { acquisition: 'raw' }), 'root'),
    scoped: i7Observed.mapSync(owned('scoped'), (value: unknown) => { i7Scoped++; return value; }, { acquisition: 'raw' }),
    transient: i7Observed.withLifetime(i7Observed.mapSync(owned('transient'), (value: unknown) => { i7Transient++; return value; }, { acquisition: 'raw' }), 'transient'),
  }).contribute(i7Token, i7Observed.mapSync(owned('first', true), (value: unknown) => { i7Contributions++; return value; }, { acquisition: 'raw' }))
    .contribute(i7Token, i7Observed.mapSync(owned('second'), (value: unknown) => { i7Contributions++; return value; }, { acquisition: 'raw' })).end();
  const i7Child = i7Bag.scope();
  i7Child.resolve('root'); i7Child.resolve('root'); i7Child.resolve('scoped'); i7Child.resolve('scoped');
  i7Child.resolve('transient'); i7Child.resolve('transient'); i7Child.resolveAll(i7Token);
  const i7Ids = [...i7Child.inspect('root').acquisitions, ...i7Child.inspect('scoped').acquisitions,
    ...i7Child.inspect('transient').acquisitions, ...i7Child.inspectAll(i7Token).flatMap((item: any) => item.acquisitions)]
    .map((item: any) => item.acquisitionId);
  let i7Close: unknown;
  try { await i7Bag.close(); } catch (error) { i7Close = error; }
  invariant(i7Close instanceof DiBagCleanupError && (i7Close as any).failures.length === 1 && (i7Close as any).failures[0].error === i7Error, 'I7', 'cleanup failure identity changed');
  const i7Failure = (i7Close as any).failures[0];
  const i7FailureEvent = i7Events.find(event => event.kind === 'cleanup-failed' && event.error === i7Error);
  invariant(new Set(i7Ids).size === 6 && i7FailureEvent && i7Failure.bindingId === i7FailureEvent.bindingId
    && i7Failure.acquisitionId === i7FailureEvent.acquisitionId && i7Failure.label === i7FailureEvent.label, 'I7', 'cleanup diagnostics changed');
  invariant(i7Root === 1 && i7Scoped === 1 && i7Transient === 2 && i7Contributions === 2 && i7Independent === 6, 'I7', 'lifetime cardinality changed');

  // I8: observer telemetry is ordered, filtered, immutable, and never awaited.
  const i8Order: string[] = [];
  const i8ObserverError = new Error('I8 observer');
  let i8BindingId: symbol | undefined; let i8AcquisitionId: symbol | undefined; let i8ReadyEvent: any;
  let i8AErrors = 0; let i8BErrors = 0; let i8Failure: any; let i8LateDisposals = 0;
  const never = new Promise<void>(() => {});
  const selected = (event: any) => event.bindingId === i8BindingId && event.acquisitionId === i8AcquisitionId
    && (event.kind === 'acquisition-ready' || event.kind === 'cleanup-completed');
  const i8Observed = DiBag.observe({
    onEvent(event: any) { if (!selected(event)) return; i8Order.push(`A:${event.kind}`); if (event.kind === 'acquisition-ready') { i8ReadyEvent = event; throw i8ObserverError; } },
    onError(failure: any) { i8AErrors++; i8Failure = failure; },
  }).observe({
    onEvent(event: any) { if (!selected(event)) return; i8Order.push(`B:${event.kind}`); return never; },
    onError() { i8BErrors++; },
  });
  const i8Gate = deferred<{ id: string }>();
  const i8Bag = i8Observed.begin().add({ late: i8Observed.withDisposal(i8Observed.factory(() => i8Gate.promise, { acquisition: 'native' }), () => { i8LateDisposals++; }) }).end();
  i8Bag.resolve('late');
  const i8Inspect = i8Bag.inspect('late');
  i8BindingId = i8Inspect.bindingId; i8AcquisitionId = i8Inspect.acquisitions[0].acquisitionId;
  const i8Closing = i8Bag.close();
  i8Gate.resolve({ id: 'late' });
  await i8Closing; await flush(); await flush();
  invariant(JSON.stringify(i8Order) === JSON.stringify(['A:acquisition-ready', 'B:acquisition-ready', 'A:cleanup-completed', 'B:cleanup-completed']), 'I8', 'callback order changed');
  invariant(i8AErrors === 1 && i8BErrors === 0 && i8Failure.error === i8ObserverError && i8Failure.event === i8ReadyEvent, 'I8', 'observer failure identity changed');
  invariant(Object.isFrozen(i8ReadyEvent) && Object.isFrozen(i8Failure), 'I8', 'observer records are mutable');

  // I9: portable automatic mode fails before effects while explicit raw preserves identity.
  let i9AutomaticEffects = 0; let i9ThenReads = 0; let i9RawDisposals = 0;
  let i9AutomaticError: unknown;
  try { PortableDiBag.begin().add({ value: () => { i9AutomaticEffects++; return 1; } }).end(); } catch (error) { i9AutomaticError = error; }
  const i9Raw = Promise.resolve({ id: 'I9' });
  const i9Then = i9Raw.then.bind(i9Raw);
  Object.defineProperty(i9Raw, 'then', { configurable: true, get() { i9ThenReads++; return i9Then; } });
  const i9Bag = PortableDiBag.begin().add({ raw: PortableDiBag.withDisposal(
    fromValBox(PortableDiBag.factory(() => new ValBox.WithValue(i9Raw), { acquisition: 'raw' }), { acquisition: 'raw' }),
    (value: unknown) => { invariant(value === i9Raw, 'I9', 'raw disposer identity changed'); i9RawDisposals++; }) }).end();
  const i9Resolved = i9Bag.resolve('raw'); await i9Bag.close();
  invariant(i9AutomaticError instanceof Error && i9AutomaticEffects === 0, 'I9', 'automatic graph ran effects');
  invariant(i9Resolved === i9Raw && i9ThenReads === 0 && i9RawDisposals === 1, 'I9', 'raw identity changed');

  // I10: capability routing reads structural then only on the async route.
  let i10ThenReads = 0;
  const i10Thenable = { get then() { i10ThenReads++; return (resolve: (value: number) => void) => resolve(10); } };
  const i10SyncBox = { sync: () => i10Thenable, async: async () => 10 };
  const i10SyncBag = DiBag.begin().add({
    sync: fromSasBox(() => i10SyncBox, { mode: 'sync', acquisition: 'raw' }),
    raw: DiBag.factory(() => i10Thenable, { acquisition: 'raw' }),
  }).end();
  const i10Sync = i10SyncBag.resolve('sync'); const i10Raw = i10SyncBag.resolve('raw'); await i10SyncBag.close();
  const i10BeforeAsync = i10ThenReads;
  const i10AsyncBox = { async: async () => 10 };
  const i10AsyncBag = DiBag.begin().add({ value: fromSasBox(() => i10AsyncBox, { mode: 'async' }) }).end();
  await i10AsyncBag.resolve('value'); await i10AsyncBag.close();
  const i10SyncFirstBox = { sync: undefined, async: () => i10Thenable };
  const i10SyncFirstBag = DiBag.begin().add({ value: fromSasBox(() => i10SyncFirstBox, { mode: 'sync-first' }) }).end();
  invariant(await i10SyncFirstBag.resolve('value') === 10, 'I10', 'sync-first route changed'); await i10SyncFirstBag.close();
  const i10Error = new Error('I10 classifier'); let i10Disposers = 0;
  const i10Events: any[] = [];
  const i10Configured = PortableDiBag.configure({ isNativePromise() { throw i10Error; } }).observe({ onEvent(event: any) { i10Events.push(event); }, onError() {} });
  let i10Failure: unknown;
  const i10FailingBag = i10Configured.begin().add({ value: i10Configured.withDisposal(() => Promise.resolve(1), () => { i10Disposers++; }) }).end();
  try { i10FailingBag.resolve('value'); } catch (error) { i10Failure = error; }
  await i10FailingBag.close();
  invariant(i10Sync === i10Thenable && i10Raw === i10Thenable && i10BeforeAsync === 0, 'I10', 'sync/raw capability changed');
  invariant(i10ThenReads === 1 && i10Failure === i10Error && i10Disposers === 0
    && !i10Events.some(event => event.kind === 'acquisition-ready'), 'I10', 'async/classification behavior changed');

  // I11: failed snapshot attempts are evicted and their upstream ownership remains accountable.
  const i11Error = new Error('I11 snapshot'); const i11Dispose: string[] = []; let i11Calls = 0;
  const i11Events: any[] = [];
  const i11Observed = DiBag.observe({ onEvent(event: any) { i11Events.push(event); }, onError() {} });
  const i11Source = DiBag.withDisposal(() => {
    i11Calls++;
    return i11Calls === 1 ? { snapshot() { throw i11Error; } } : new ValBox.WithValue({ id: 'valid' });
  }, () => { i11Dispose.push('source'); });
  const i11Bag = i11Observed.begin().add({ value: fromValBox(i11Source) }).end();
  let i11Failure: unknown;
  try { i11Bag.resolve('value'); } catch (error) { i11Failure = error; }
  const i11FailedId = i11Bag.inspect('value').acquisitions.at(-1).acquisitionId;
  const i11Value = i11Bag.resolve('value');
  const i11RetryId = i11Bag.inspect('value').acquisitions.at(-1).acquisitionId;
  await i11Bag.close();
  invariant(i11Failure === i11Error && i11Value.id === 'valid' && i11FailedId !== i11RetryId, 'I11', 'boundary retry changed');
  const i11FailedEvent = i11Events.find(event => event.kind === 'acquisition-failed' && event.error === i11Error);
  invariant(i11FailedEvent && i11FailedEvent.frames.every((frame: any) => frame.present === false), 'I11', 'failed frame was fabricated');
  invariant(JSON.stringify(i11Dispose) === JSON.stringify(['source', 'source']), 'I11', 'source disposal changed');

  // I12: ordinary, aborted, and timed-out startup retain their exact wrappers and causes.
  const i12PluginCause = new Error('I12 plugin');
  const i12Ordinary = await DiBag.begin().add({ fail: DiBag.fromPlugin([], { apiVersion: 1, create() { throw i12PluginCause; } },
    { acquisition: 'raw', validate: (_value: unknown): _value is number => true }) }).start(['fail']).catch((error: unknown) => error);
  const i12Dispose: string[] = []; const i12Late = deferred<{ id: string }>(); const i12Abort = new AbortController(); const i12AbortCause = new Error('I12 abort');
  const i12Items = DiBag.token(Symbol('I12-items')).of();
  const i12CleanupEvents: any[] = [];
  let i12OwnerScope: symbol | undefined;
  const i12Observed = DiBag.observe({ onEvent(event: any) {
    if (event.kind === 'scope-opened' && !('parentScopeId' in event)) i12OwnerScope = event.scopeId;
    if (event.kind === 'cleanup-completed') i12CleanupEvents.push(event);
  }, onError() {} });
  const i12Starting = i12Observed.begin().add({
    adapter: i12Observed.withDisposal(fromValBox(() => new ValBox.WithValue({ id: 'immediate' })), () => { i12Dispose.push('immediate'); }),
    plugin: i12Observed.fromPlugin([], { apiVersion: 1, create: () => ({ id: 'plugin' }) },
      { acquisition: 'raw', validate: (value: unknown): value is object => typeof value === 'object' && value !== null }),
    items: i12Observed.fromTokens([i12Observed.all(i12Items)], (items: readonly unknown[]) => items),
    late: DiBag.withDisposal(DiBag.factory(() => i12Late.promise, { acquisition: 'native' }), () => { i12Dispose.push('late'); }),
  }).contribute(i12Items, fromSasBox(() => SasBox.fromValue(1), { mode: 'sync' }))
    .contribute(i12Items, fromValBox(() => new ValBox.WithValue(2)))
    .start(['adapter', 'plugin', 'items', 'late'], { signal: i12Abort.signal });
  i12Abort.abort(i12AbortCause);
  const i12Cancelled = await i12Starting.catch((error: unknown) => error);
  i12Late.resolve({ id: 'late' });
  await i12Cancelled.cleanup; await flush();
  invariant(i12CleanupEvents.length === 2 && new Set(i12CleanupEvents.map(event => event.acquisitionId)).size === 2
    && i12CleanupEvents.every(event => event.scopeId === i12OwnerScope)
    && new Set(i12CleanupEvents.map(event => event.label)).has('adapter')
    && new Set(i12CleanupEvents.map(event => event.label)).has('late'),
    'I12', 'cleanup observer owner identity changed');
  const i12TimeoutGate = deferred<number>();
  const i12TimeoutDispose: string[] = [];
  const i12Timeout = await DiBag.begin().add({
    immediate: DiBag.withDisposal(() => 1, () => { i12TimeoutDispose.push('immediate'); }),
    late: DiBag.withDisposal(DiBag.factory(() => i12TimeoutGate.promise, { acquisition: 'native' }), () => { i12TimeoutDispose.push('late'); }),
  }).start(['immediate', 'late'], { timeoutMs: 5 }).catch((error: unknown) => error);
  i12TimeoutGate.resolve(1); await i12Timeout.cleanup;
  invariant(i12Ordinary instanceof DiBagStartupError && i12Ordinary.cause === i12PluginCause && i12Ordinary.cleanupFailures.length === 0, 'I12', 'ordinary wrapper changed');
  invariant(i12Cancelled instanceof DiBagStartupCancelledError && i12Cancelled.reason === 'aborted' && i12Cancelled.cause === i12AbortCause, 'I12', 'abort wrapper changed');
  invariant(i12Timeout instanceof DiBagStartupCancelledError && i12Timeout.reason === 'timeout' && i12Timeout.cause?.name === 'TimeoutError', 'I12', 'timeout wrapper changed');
  invariant(JSON.stringify(i12Dispose) === JSON.stringify(['immediate', 'late']), 'I12', `late cleanup changed: ${JSON.stringify(i12Dispose)}`);
  invariant(JSON.stringify(i12TimeoutDispose) === JSON.stringify(['immediate', 'late']), 'I12', `timeout cleanup changed: ${JSON.stringify(i12TimeoutDispose)}`);

  // I13: admission closes before a captured lazy reference can acquire.
  const i13Dispose: string[] = []; let i13Effects = 0; let i13Lazy: (() => unknown) | undefined;
  const i13Token = DiBag.token(Symbol('I13')).of();
  const i13Parent = DiBag.begin().bind(i13Token, DiBag.withDisposal(() => { i13Effects++; return {}; }, () => {})).add({
    parent: DiBag.withLifetime(DiBag.withDisposal(() => ({}), () => { i13Dispose.push('parent'); }), 'root'),
    capture: DiBag.fromTokens([DiBag.lazy(i13Token)], (get: () => unknown) => { i13Lazy = get; return {}; }),
  }).end();
  const i13Child = i13Parent.scope().scope();
  const i13ChildResource = DiBag.withDisposal(() => ({}), () => { i13Dispose.push('child'); });
  const i13OwnedChild = i13Child.scope(['parent'], { parent: i13ChildResource });
  i13OwnedChild.resolve('capture');
  i13OwnedChild.resolve('parent');
  i13Parent.resolve('parent');
  const i13ForkDisposal = deferred<void>();
  const i13Fork = i13Parent.fork(['parent'], { parent: DiBag.withDisposal(() => ({}), async () => { await i13ForkDisposal.promise; i13Dispose.push('fork'); }) });
  i13Fork.resolve('parent');
  const i13Ids = [i13OwnedChild.inspect('parent').acquisitions[0].acquisitionId, i13Parent.inspect('parent').acquisitions[0].acquisitionId, i13Fork.inspect('parent').acquisitions[0].acquisitionId];
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
    I1: { payloadIdentity: true, metadataIdentity: true, aliasIdentity: true, dispose: i1Dispose as ['payload', 'sas'], acquisitions: i1Inspection.acquisitions.length as 1 },
    I2: { nativePromise: true, rootShared: true, transientDistinct: true, childDispose: i2ChildDispose as ['transient-2', 'transient-1', 'scoped'], parentDispose: i2Dispose as ['transient-2', 'transient-1', 'scoped', 'root'], acquisitions: new Set(i2Acquisitions).size as 4 },
    I3: { absentIdentity: true, presentUndefined: true, getterIdentity: true, dispose: i3Dispose as ['source'], acquisitions: new Set(i3StartedIds).size as 3 },
    I4: { outputPhase: 'output', errorIdentity: true, startupWrapper: i4Startup.name, startupCauseIdentity: true, dispose: i4Dispose as ['plugin', 'sas'], payloadDisposals: i4ImplicitPayloadDisposals as 0, acquisitions: i4Acquisitions as 1 },
    I5: { directRetained: true, directDispose: i5DirectDispose as ['direct-1'], startupWrapper: i5Started.name, startupCauseIdentity: true, startupDispose: i5StartupDispose as ['startup-first'], retryFresh: i5Failed !== i5RetryId },
    I6: { aliasAcquisitions: 0, sharedIdentity: true, unsharedDistinct: true, dispose: i6Dispose as ['installation-2', 'installation-1'], acquisitions: i6Created as 2 },
    I7: { root: i7Root as 1, scoped: i7Scoped as 1, transient: i7Transient as 2, contributions: i7Contributions as 2, cleanupFailureIdentity: true, independentCleanupCount: (i7Independent - 1) as 5 },
    I8: { callbackOrder: i8Order as any, filteredOnEventCalls: i8Order.length as 4, aOnErrorCalls: i8AErrors as 1, bOnErrorCalls: i8BErrors as 0, observerErrorIdentity: true, observerErrorEventIdentity: true, telemetryBlocksClose: false, lateDisposals: i8LateDisposals as 1 },
    I9: { automaticEffects: i9AutomaticEffects as 0, rawIdentity: true, thenReads: i9ThenReads as 0, rawDisposals: i9RawDisposals as 1 },
    I10: { syncIdentity: true, rawIdentity: true, syncRawThenReads: i10BeforeAsync as 0, asyncThenReads: i10ThenReads as 1, failureIdentity: true, disposerCalls: i10Disposers as 0 },
    I11: { boundaryErrorIdentity: true, retryFresh: i11FailedId !== i11RetryId, dispose: i11Dispose as ['source', 'source'] },
    I12: { ordinaryWrapper: i12Ordinary.name, ordinaryCauseIdentity: true, ordinaryCleanupFailures: i12Ordinary.cleanupFailures.length as 0, abortWrapper: i12Cancelled.name, abortCauseIdentity: true, timeoutWrapper: i12Timeout.name, timeoutCauseName: i12Timeout.cause.name, dispose: i12Dispose as ['immediate', 'late'] },
    I13: { closingEffects: i13Effects as 0, parentDispose: i13ParentDispose as ['child', 'parent'], finalDispose: i13Dispose as ['child', 'parent', 'fork'], unsharedDistinct: true },
    I14: { classicPositiveDiagnostics: 0, cjsPositiveDiagnostics: 0, mjsPositiveDiagnostics: 0, classicNegativeMarkers: 2, newNativeGapIds: [] },
    I15: { cjsMatchesSource: true, esmMatchesSource: true, coreHasBoxes: false, rootLoadsNode: false, forbiddenFiles: 0 },
  } as FinalAdversarialRuntimeResult;
}

export function runFinalAdversarialSourceMatrix(selectedId?: keyof FinalAdversarialRuntimeResult): Promise<FinalAdversarialRuntimeResult> {
  return executeFinalAdversarialMatrix({ DiBag, PortableDiBag, DiBagCleanupError, DiBagPluginError,
    DiBagStartupError, DiBagStartupCancelledError, fromSasBox, fromValBox, fromValBoxAsync, SasBox, ValBox }, selectedId);
}

/** Embedded by package tests after binding these public API names in consumer scope. */
export const finalAdversarialRuntimeAssertions = `
(async () => {
  const result = await (${executeFinalAdversarialMatrix.toString()})({ DiBag, PortableDiBag, DiBagCleanupError,
    DiBagPluginError, DiBagStartupError, DiBagStartupCancelledError, fromSasBox, fromValBox,
    fromValBoxAsync, SasBox, ValBox });
  console.log(JSON.stringify(result));
})().catch(error => { console.error(error); process.exitCode = 1; });
`;
