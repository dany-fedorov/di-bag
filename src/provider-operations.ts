import type { Factory } from './registration';
import type { AcquisitionMode } from './acquisition-mode';
import type { LifetimePolicy } from './lifetime';

interface SourceOperation {
  readonly kind: 'source';
  readonly create: Factory;
  readonly acquisition: AcquisitionMode;
  readonly tokenKeys: readonly symbol[];
  readonly dispose?: (value: never) => void | Promise<void>;
}
interface MetadataOperation {
  readonly kind: 'metadata';
  readonly metadata: Readonly<object>;
}
export interface OwnedOperation {
  readonly kind: 'owned';
  readonly dispose: (value: never) => void | Promise<void>;
}
interface MapOperation {
  readonly kind: 'map-sync' | 'map-async';
  readonly acquisition: AcquisitionMode;
  readonly project: (this: void, value: never) => unknown;
}
interface FrameOperation {
  readonly kind: 'frame-sync' | 'frame-async';
  readonly acquisition: AcquisitionMode;
  readonly project: (this: void, value: never) => { readonly value: unknown; readonly frame: unknown };
}
export type ProviderOperation = MetadataOperation | OwnedOperation | MapOperation | FrameOperation;
export interface ProviderDescription {
  readonly lifetime: LifetimePolicy;
  readonly source: SourceOperation;
  readonly operations: readonly ProviderOperation[];
  readonly metadata: Readonly<object>;
}

const emptyMetadata = Object.freeze({});
const scopedLifetime: LifetimePolicy = Object.freeze({ kind: 'scoped', captureScoped: false });
const descriptions = new WeakMap<object, ProviderDescription>();

export function sourceDescription(
  create: Factory,
  dispose?: (value: never) => void | Promise<void>,
  tokenKeys: readonly symbol[] = [],
  acquisition: AcquisitionMode = 'auto',
): ProviderDescription {
  const selected = Object.freeze([...tokenKeys]);
  const source: SourceOperation = Object.freeze(dispose ? { kind: 'source', create, dispose, tokenKeys: selected, acquisition } : { kind: 'source', create, tokenKeys: selected, acquisition });
  return Object.freeze({ source, operations: Object.freeze([]), metadata: emptyMetadata, lifetime: scopedLifetime });
}

/** One registry authenticates both ownership handles and transformed providers. */
export function retainDescription(handle: object, description: ProviderDescription): void {
  descriptions.set(handle, description);
  Object.freeze(handle);
}

export function describe(registration: unknown): ProviderDescription {
  if (typeof registration === 'function') return sourceDescription(registration as Factory);
  if (typeof registration === 'object' && registration !== null) {
    const description = descriptions.get(registration);
    if (description) return description;
  }
  throw new Error('invalid factory registration');
}

export function normalize(registration: unknown): {
  lifetime: LifetimePolicy;
  create: Factory;
  acquisition: AcquisitionMode;
  tokenKeys: readonly symbol[];
  dispose?: (value: never) => void | Promise<void>;
  metadata: Readonly<object>;
  operations: readonly ProviderOperation[];
} {
  const description = describe(registration);
  const { create, dispose, tokenKeys, acquisition } = description.source;
  const { metadata, operations, lifetime } = description;
  return dispose ? { create, dispose, tokenKeys, acquisition, metadata, operations, lifetime } : { create, tokenKeys, acquisition, metadata, operations, lifetime };
}
