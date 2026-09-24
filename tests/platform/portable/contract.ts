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

type PortableToken<T> = { readonly symbol: symbol; readonly __service?: T };

/** The smallest structural slice of the public root API used by this fixture. */
export type PortableDiBag = {
  createBuilder(): any;
  createProvider(factory: (...dependencies: any[]) => unknown, options: { factoryReturnKind: 'uninspected' | 'sync-value' | 'native-promise' }): any;
  createToken(key: symbol): { forService<T>(): PortableToken<T> };
  providerWithDisposal(options: { provider: any; disposeService: (value: any) => void | Promise<void> }): any;
  providerWithLifetime(options: { provider: any; lifetime: 'singleton:one-per-container-tree' | 'scoped:one-per-container' | 'transient:one-per-resolve'; allowsScopedDependencies?: boolean }): any;
  providerWithRegistrationMetadata(options: { provider: any; registrationMetadata: Readonly<Record<string, unknown>> }): any;
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
  const exported = DiBag.createToken(Symbol('portable-export')).forService<typeof privateHelper>();
  const feature = DiBag.createBuilder().withServices({ helper: DiBag.createProvider(() => privateHelper, { factoryReturnKind: 'sync-value' }) }).withTokenService(exported, DiBag.createProvider(({ helper }: { helper: typeof privateHelper }) => helper, { factoryReturnKind: 'sync-value' })).buildModule({ exportedServiceKeys: [exported] });

  let rootCalls = 0;
  let scopedCalls = 0;
  let transientCalls = 0;
  const rawPromise = Promise.resolve({ value: 'raw' });
  let rawDisposed: unknown;
  let asyncDisposed: { value: string } | undefined;
  const root = DiBag.createBuilder().withInstalledModules([feature]).withServices({
    root: DiBag.providerWithRegistrationMetadata({ provider: DiBag.providerWithLifetime({ provider: DiBag.providerWithDisposal({ provider: DiBag.createProvider(() => ({ id: ++rootCalls }), { factoryReturnKind: 'sync-value' }), disposeService: () => { cleanupLog.push('root'); },  }), lifetime: 'singleton:one-per-container-tree' }), registrationMetadata: { portable: true } }),
    scoped: DiBag.providerWithDisposal({ provider: DiBag.createProvider(() => ({ id: ++scopedCalls }), { factoryReturnKind: 'sync-value' }), disposeService: () => { cleanupLog.push('scoped'); },  }),
    transient: DiBag.providerWithLifetime({ provider: DiBag.providerWithDisposal({ provider: DiBag.createProvider(() => ({ id: ++transientCalls }), { factoryReturnKind: 'sync-value' }), disposeService: value => { cleanupLog.push(`transient-${value.id}`); },  }), lifetime: 'transient:one-per-resolve' }),
    // The Promise object itself is the service: the explicit raw form stays the way to say so.
    raw: DiBag.providerWithDisposal({ provider: DiBag.createProvider(() => rawPromise, { factoryReturnKind: 'uninspected' }), disposeService: value => { rawDisposed = value; },  }),
    pending: DiBag.providerWithDisposal({ provider: DiBag.createProvider(async () => ({ value: 'async' }), { factoryReturnKind: 'native-promise' }), disposeService: (value: { value: string }) => { asyncDisposed = value; },  }),
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
