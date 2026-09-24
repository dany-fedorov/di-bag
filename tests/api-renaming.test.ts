import { expect, test } from 'bun:test';
import { DiBag, DiBagDisposalError } from '../src';

function caught(callback: () => unknown): any {
  try { callback(); } catch (error) { return error; }
  throw new Error('expected an error');
}

test('combined metadata retains static descriptions and ordered direct/awaited frames', async () => {
  const value = Promise.resolve({ id: 7 });
  const base = DiBag.createProvider(() => value, { factoryReturnKind: 'uninspected' });
  const direct = DiBag.providerWithAcquisitionMetadata({
    provider: DiBag.providerWithRegistrationMetadata({ provider: base, registrationMetadata: { module: 'billing' } }),
    callbackReceives: 'exposed-service',
    describeAcquisition: pending => ({ same: pending === value }),
  });
  const annotated = DiBag.providerWithAcquisitionMetadata({ provider: direct, describeAcquisition: item => ({ id: item.id, payload: undefined }), callbackReceives: 'fulfilled-value' });
  const bag = DiBag.createBuilder().withServices({ direct, annotated }).buildContainer();
  expect(bag.serviceSnapshot('annotated').registrationMetadata).toEqual({ module: 'billing' });
  expect(bag.resolve('direct')).toBe(value);
  expect(await bag.resolve('annotated')).toEqual({ id: 7 });
  expect(bag.serviceSnapshot('annotated').acquisitions[0]!.acquisitionMetadata).toEqual([
    { present: true, value: { same: true } },
    { present: true, value: { id: 7, payload: undefined } },
  ]);
  await bag.close();
});

test('metadata collisions preflight and asynchronous metadata callbacks reject', async () => {
  const source = DiBag.providerWithRegistrationMetadata({ provider: () => 1, registrationMetadata: { owner: 'a' } });
  let reads = 0;
  const collision = caught(() => DiBag.providerWithRegistrationMetadata({ provider: source, registrationMetadata: { get owner() { reads++; return 'b'; } } } as never));
  expect(collision.code).toBe('DI_BAG_DUPLICATE_METADATA_KEY');
  expect(Object.isFrozen(collision.details)).toBe(true);
  expect(reads).toBe(0);
  for (const mode of ['direct', 'awaited'] as const) {
    const bad = DiBag.providerWithAcquisitionMetadata({ provider: () => 1, callbackReceives: mode === 'direct' ? 'exposed-service' : 'fulfilled-value', describeAcquisition: async () => ({ bad: true }) } as never);
    const bag = (DiBag.createBuilder() as any).withServices({ bad }).buildContainer();
    if (mode === 'direct') expect(caught(() => bag.resolve('bad')).code).toBe('DI_BAG_INVALID_METADATA');
    else await expect(bag.resolve('bad')).rejects.toMatchObject({ code: 'DI_BAG_INVALID_METADATA' });
    await bag.close();
  }
});

test('providerWithTransformedService retains earlier ownership and raw output disposal policy', async () => {
  const disposed: unknown[] = [];
  const connection = { id: 9 };
  const pending = Promise.resolve('result');
  const source = DiBag.providerWithDisposal({ provider: () => connection, disposeService: value => { disposed.push(value); } });
  const transformed = DiBag.providerWithDisposal({ provider: DiBag.providerWithTransformedService({ provider: source, transformService: value => { expect(value).toBe(connection); return pending; }, callbackReceives: 'exposed-service', transformReturnKind: 'uninspected' }), disposeService: value => { disposed.push(value); } });
  const bag = DiBag.createBuilder().withServices({ transformed }).buildContainer();
  expect(bag.resolve('transformed')).toBe(pending);
  await bag.close();
  expect(disposed).toEqual([pending, connection]);
});

test('register, acquisition context, modules and immutable observer configuration compose', async () => {
  const order: number[] = [];
  const observer = (id: number) => ({ onLifecycleEvent: () => { order.push(id); }, onObserverFailure: () => {} });
  const api = DiBag.withConfiguration({ lifecycleObservers: [observer(1)] }).withConfiguration({ lifecycleObservers: [observer(2)] });
  const configKey = Symbol('config');
  const token = api.createToken(configKey).forService<number>();
  let signal: AbortSignal | undefined;
  const module = api.createBuilder().withServices({ internal: () => 3 }).buildModule({ exportedServiceKeys: ['internal'] }).withRenamedExport({ currentExportKey: 'internal', newExportKey: 'number' });
  const bag = api.createBuilder().withTokenService(token, () => 4).withInstalledModules([module]).withServices({
    contextual: api.createProvider(({ number }: { number: number }, context) => { signal = context.abortSignal; return number; }, { factoryReceivesContext: true }),
  }).buildContainer();
  expect(bag.resolve(token)).toBe(4);
  expect(bag.resolve('contextual')).toBe(3);
  const child = bag.createChildContainer();
  await bag.close();
  expect(signal!.aborted).toBe(true);
  expect(caught(() => child.resolve('number')).message).toContain('closed');
  expect(order.length).toBeGreaterThan(0);
  for (let index = 0; index < order.length; index += 2) expect(order.slice(index, index + 2)).toEqual([1, 2]);
});

test('diagnostics count callbacks, retain cycles and preserve application error identity', async () => {
  const applicationError = new Error('application');
  const bad = DiBag.createBuilder().withServices({ bad: () => { throw applicationError; } }).buildContainer();
  expect(caught(() => bad.resolve('bad'))).toBe(applicationError);
  await bad.close();
  const closed = caught(() => bad.resolve('bad'));
  expect(closed).toMatchObject({ code: 'DI_BAG_CLOSED', details: { state: 'closed' } });
  let cycleBag: any;
  cycleBag = DiBag.createBuilder().withServices({ a: () => cycleBag.resolve('b'), b: () => cycleBag.resolve('a') }).buildContainer();
  const cycle = caught(() => cycleBag.resolve('a'));
  expect(cycle.message).toContain('a -> b -> a');
  expect(cycle.details.path).toEqual(['a', 'b', 'a']);
  await cycleBag.close();
  const dispose = () => { throw applicationError; };
  const owned = DiBag.providerWithDisposal({ provider: DiBag.providerWithDisposal({ provider: () => 1, disposeService: dispose }), disposeService: dispose });
  const bag = DiBag.createBuilder().withServices({ owned }).buildContainer();
  bag.resolve('owned');
  try { await bag.close(); throw new Error('expected cleanup failure'); }
  catch (error) {
    expect(error).toBeInstanceOf(DiBagDisposalError);
    expect((error as Error).message).toContain('2 disposal callback(s)');
    expect((error as DiBagDisposalError).errors).toEqual([applicationError, applicationError]);
  }
});

test('missing dependency diagnostics identify consumer and complete resolution path', async () => {
  const bag = DiBag.createBuilder().withServices({ api: ({ db }: { db: unknown }) => db } as never).buildContainer();
  const error = caught(() => (bag as any).resolve('api'));
  expect(error.code).toBe('DI_BAG_MISSING_DEPENDENCY');
  expect(error.details).toMatchObject({ consumer: 'api', dependency: 'db', path: ['api', 'db'] });
  expect(Object.isFrozen(error.details.path)).toBe(true);
  await bag.close();
});

test('closed facades distinguish closed from closing across fork and createScope', async () => {
  const bag = DiBag.createBuilder().buildContainer();
  const closing = bag.close();
  expect(caught(() => bag.createIndependentContainer())).toMatchObject({ code: 'DI_BAG_CLOSING', details: { state: 'closing' } });
  await closing;
  expect(caught(() => bag.createIndependentContainer())).toMatchObject({ code: 'DI_BAG_CLOSED', details: { state: 'closed' } });
  expect(caught(() => bag.createChildContainer())).toMatchObject({ code: 'DI_BAG_CLOSED', details: { state: 'closed' } });
});

test('provider metadata facades reject inherited options before reading them', () => {
  let reads = 0;
  const options = Object.assign(Object.create({
    get registrationMetadata() { reads++; return { invalid: true }; },
  }), { provider: () => 1 });
  expect(caught(() => DiBag.providerWithRegistrationMetadata(options as never))).toMatchObject({ code: 'DI_BAG_INVALID_ARGUMENT' });
  expect(reads).toBe(0);
  const inheritedCallback = Object.assign(Object.create({ callbackReceives: 'exposed-service' }), {
    provider: () => 1, describeAcquisition: () => ({}),
  });
  expect(caught(() => DiBag.providerWithAcquisitionMetadata(inheritedCallback as never))).toMatchObject({ code: 'DI_BAG_INVALID_ARGUMENT' });
});

test('metadata snapshots dynamic mode and callback once before static getters run', async () => {
  let modeReads = 0;
  let callbackReads = 0;
  let optionsReads = 0;
  const dynamic = {
    get mode() { modeReads++; return modeReads === 1 ? 'direct' as const : 'awaited' as const; },
    get describe() { callbackReads++; return (value: number) => ({ value }); },
  };
  const options = {
    get dynamic() { optionsReads++; return dynamic; },
    get static() {
      Object.defineProperty(dynamic, 'describe', { value: () => ({ wrong: true }) });
      return { tag: 'snapshot' };
    },
  };
  // The hostile getter changes modes; its first read is deliberately direct.
  const snapshottedDynamic = options.dynamic;
  const provider = DiBag.providerWithRegistrationMetadata({
    provider: DiBag.providerWithAcquisitionMetadata({
      provider: () => 7,
      get callbackReceives(): 'exposed-service' {
        if (snapshottedDynamic.mode !== 'direct') throw new Error('expected direct snapshot');
        return 'exposed-service';
      },
      get describeAcquisition() { return snapshottedDynamic.describe; },
    }),
    get registrationMetadata() { return options.static; },
  });
  const bag = DiBag.createBuilder().withServices({ provider }).buildContainer();
  expect(bag.resolve('provider')).toBe(7);
  expect(modeReads).toBe(1);
  expect(callbackReads).toBe(1);
  expect(optionsReads).toBe(1);
  expect(bag.serviceSnapshot('provider').acquisitions[0]!.acquisitionMetadata).toEqual([{ present: true, value: { value: 7 } }]);
  await bag.close();
});
