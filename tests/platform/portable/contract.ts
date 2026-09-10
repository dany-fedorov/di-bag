export type PortableContractResult = {
  readonly aliasCanonical: true;
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
  createBuilder(): any;
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

export async function portableContract(DiBag: PortableDiBag): Promise<PortableContractResult> {
  const cleanupLog: string[] = [];
  const privateHelper = Object.freeze({ source: 'private-module-helper' });
  const exported = DiBag.token(Symbol('portable-export')).of<typeof privateHelper>();
  const feature = DiBag.createBuilder().register({ helper: DiBag.fromFactory(() => privateHelper, { acquisitionMode: 'raw' }) }).register(exported, DiBag.fromFactory(({ helper }: { helper: typeof privateHelper }) => helper, { acquisitionMode: 'raw' })).buildModule([exported]);

  let rootCalls = 0;
  let scopedCalls = 0;
  let transientCalls = 0;
  const rawPromise = Promise.resolve({ value: 'raw' });
  let rawDisposed: unknown;
  const root = DiBag.createBuilder().installModule(feature).register({
    root: DiBag.withMetadata(DiBag.withLifetime(DiBag.withDisposal(
      DiBag.fromFactory(() => ({ id: ++rootCalls }), { acquisitionMode: 'raw' }),
      () => { cleanupLog.push('root'); },
    ), 'root'), { static: { portable: true } }),
    scoped: DiBag.withDisposal(
      DiBag.fromFactory(() => ({ id: ++scopedCalls }), { acquisitionMode: 'raw' }),
      () => { cleanupLog.push('scoped'); },
    ),
    transient: DiBag.withLifetime(DiBag.withDisposal(
      DiBag.fromFactory(() => ({ id: ++transientCalls }), { acquisitionMode: 'raw' }),
      value => { cleanupLog.push(`transient-${value.id}`); },
    ), 'transient'),
    raw: DiBag.withDisposal(
      DiBag.fromFactory(() => rawPromise, { acquisitionMode: 'raw' }),
      value => { rawDisposed = value; },
    ),
  }).alias('rootAlias', 'root').build();
  const child = root.createScope();

  const rootValue = child.resolve('root');
  const aliasCanonical = child.resolve('rootAlias') === rootValue
    && root.resolve('root') === rootValue
    && root.resolve(exported) === privateHelper;
  const transient1 = child.resolve('transient');
  const transient2 = child.resolve('transient');
  const scoped1 = child.resolve('scoped');
  const scoped2 = child.resolve('scoped');
  const rawValue = child.resolve('raw');
  const inspection = child.inspect('root');
  const inspectionProof = validatePortableInspection(inspection);

  await child.close();
  await root.close();

  return {
    aliasCanonical: aliasCanonical as true,
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
