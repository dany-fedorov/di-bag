export type PortableContractResult = {
  readonly aliasCanonical: true;
  readonly asyncDisposerValue: true;
  readonly asyncFulfilled: true;
  readonly asyncPromiseIdentity: true;
  readonly cleanupLog: readonly ['scoped', 'transient-2', 'transient-1', 'root'];
  readonly inspectionFrozen: true;
  readonly metadataFrozen: true;
  readonly rawDisposerIdentity: true;
  readonly rawPromiseIdentity: true;
  readonly rootOnce: true;
  readonly scopedOnce: true;
  readonly transientDistinct: true;
};

type PortableToken<T> = { readonly key: symbol; readonly __service?: T };

/** The smallest structural slice of the public root API used by this fixture. */
export type PortableDiBag = {
  createBuilder(): any;
  fromFactory(factory: (...dependencies: any[]) => unknown, options: { acquisitionMode: 'raw' }): any;
  fromSyncFactory(factory: (...dependencies: any[]) => unknown): any;
  fromAsyncFactory(factory: (...dependencies: any[]) => Promise<unknown>): any;
  token(key: symbol): { of<T>(): PortableToken<T> };
  withDisposal(factory: any, dispose: (value: any) => void | Promise<void>): any;
  withLifetime(factory: any, lifetime: 'root' | 'scoped' | 'transient'): any;
  withMetadata(factory: any, metadata: Readonly<Record<string, unknown>>): any;
};

export function validatePortableInspection(inspection: unknown): {
  inspectionFrozen: boolean;
  metadataFrozen: boolean;
} {
  if (typeof inspection !== 'object' || inspection === null || Array.isArray(inspection)) {
    return { inspectionFrozen: false, metadataFrozen: false };
  }
  try {
    const metadata = (inspection as { registrationMetadata?: unknown }).registrationMetadata;
    if (typeof metadata !== 'object' || metadata === null || Array.isArray(metadata)) {
      return { inspectionFrozen: false, metadataFrozen: false };
    }
    const metadataKeys = Reflect.ownKeys(metadata);
    if (metadataKeys.length !== 1 || metadataKeys[0] !== 'portable'
      || (metadata as { portable?: unknown }).portable !== true) {
      return { inspectionFrozen: false, metadataFrozen: false };
    }
    return {
      inspectionFrozen: Object.isFrozen(inspection),
      metadataFrozen: Object.isFrozen(metadata),
    };
  } catch {
    return { inspectionFrozen: false, metadataFrozen: false };
  }
}

/**
 * Host-dependent probe: the root entry resolves an automatic async factory where the host exposes
 * process.getBuiltinModule, and otherwise rejects at build with DI_BAG_CLASSIFIER_REQUIRED.
 */
export function automaticAcquisition(DiBag: PortableDiBag): Promise<'resolved' | string> {
  let bag: any;
  try { bag = DiBag.createBuilder().withServices({ answer: async () => 42 }).buildContainer(); }
  catch (error) { return Promise.resolve(String((error as { code?: unknown }).code)); }
  return Promise.resolve(bag.resolve('answer')).then(async (value: unknown) => {
    await bag.close();
    return value === 42 ? 'resolved' : 'wrong-value';
  });
}

export async function portableContract(DiBag: PortableDiBag): Promise<PortableContractResult> {
  const cleanupLog: string[] = [];
  const privateHelper = Object.freeze({ source: 'private-module-helper' });
  const exported = DiBag.token(Symbol('portable-export')).of<typeof privateHelper>();
  const feature = DiBag.createBuilder().withServices({ helper: DiBag.fromSyncFactory(() => privateHelper) }).withTokenService(exported, DiBag.fromSyncFactory(({ helper }: { helper: typeof privateHelper }) => helper)).buildModule({ exportedServiceKeys: [exported] });

  let rootCalls = 0;
  let scopedCalls = 0;
  let transientCalls = 0;
  const rawPromise = Promise.resolve({ value: 'raw' });
  let rawDisposed: unknown;
  let asyncDisposed: { value: string } | undefined;
  const root = DiBag.createBuilder().withInstalledModules([feature]).withServices({
    root: DiBag.withMetadata(DiBag.withLifetime(DiBag.withDisposal(
      DiBag.fromSyncFactory(() => ({ id: ++rootCalls })),
      () => { cleanupLog.push('root'); },
    ), 'root'), { static: { portable: true } }),
    scoped: DiBag.withDisposal(
      DiBag.fromSyncFactory(() => ({ id: ++scopedCalls })),
      () => { cleanupLog.push('scoped'); },
    ),
    transient: DiBag.withLifetime(DiBag.withDisposal(
      DiBag.fromSyncFactory(() => ({ id: ++transientCalls })),
      value => { cleanupLog.push(`transient-${value.id}`); },
    ), 'transient'),
    // The Promise object itself is the service: the explicit raw form stays the way to say so.
    raw: DiBag.withDisposal(
      DiBag.fromFactory(() => rawPromise, { acquisitionMode: 'raw' }),
      value => { rawDisposed = value; },
    ),
    pending: DiBag.withDisposal(
      DiBag.fromAsyncFactory(async () => ({ value: 'async' })),
      (value: { value: string }) => { asyncDisposed = value; },
    ),
  }).withServiceAlias({ aliasKey: 'rootAlias', targetServiceKey: 'root' }).buildContainer();
  const child = root.createChildContainer();

  const rootValue = child.resolve('root');
  const aliasCanonical = child.resolve('rootAlias') === rootValue
    && root.resolve('root') === rootValue
    && root.resolve(exported) === privateHelper;
  const transient1 = child.resolve('transient');
  const transient2 = child.resolve('transient');
  const scoped1 = child.resolve('scoped');
  const scoped2 = child.resolve('scoped');
  const rawValue = child.resolve('raw');
  const pending1 = child.resolve('pending');
  const pending2 = child.resolve('pending');
  const asyncPromiseIdentity = pending1 === pending2 && pending1 instanceof Promise;
  const asyncFulfilled = (await pending1).value === 'async';
  const inspection = child.serviceSnapshot('root');
  const inspectionProof = validatePortableInspection(inspection);

  await child.close();
  await root.close();

  return {
    aliasCanonical: aliasCanonical as true,
    asyncDisposerValue: (asyncDisposed !== undefined && asyncDisposed.value === 'async') as true,
    asyncFulfilled: asyncFulfilled as true,
    asyncPromiseIdentity: asyncPromiseIdentity as true,
    cleanupLog: cleanupLog as unknown as PortableContractResult['cleanupLog'],
    inspectionFrozen: inspectionProof.inspectionFrozen as true,
    metadataFrozen: inspectionProof.metadataFrozen as true,
    rawDisposerIdentity: (rawDisposed === rawPromise) as true,
    rawPromiseIdentity: (rawValue === rawPromise) as true,
    rootOnce: (rootCalls === 1) as true,
    scopedOnce: (scopedCalls === 1 && scoped1 === scoped2) as true,
    transientDistinct: (transientCalls === 2 && transient1 !== transient2) as true,
  };
}
