import { libraryError } from './errors';
import type { ArgumentReference } from './dependency-references';
import type { Factory } from './registration';
import type { AcquisitionMode } from './acquisition-mode';
import type { LifetimePolicy } from './lifetime';

interface SourceOperation {
  readonly kind: 'source';
  readonly create: Factory;
  readonly acquisitionMode: AcquisitionMode;
  readonly tokenKeys: readonly symbol[];
  readonly references: readonly ArgumentReference[];
  readonly contextual: boolean;
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
  readonly acquisitionMode: AcquisitionMode;
  readonly project: (this: void, value: never) => unknown;
}
interface FrameOperation {
  readonly kind: 'frame-sync' | 'frame-async';
  readonly acquisitionMode: AcquisitionMode;
  readonly project: (this: void, value: never) => { readonly value: unknown; readonly frame: unknown };
}
export type ProviderOperation = MetadataOperation | OwnedOperation | MapOperation | FrameOperation;
export interface ProviderDescription {
  readonly lifetime: LifetimePolicy;
  readonly alias?: string | symbol;
  readonly source: SourceOperation;
  readonly operations: readonly ProviderOperation[];
  readonly metadata: Readonly<object>;
}

const emptyMetadata = Object.freeze({});
const scopedLifetime: LifetimePolicy = Object.freeze({ kind: 'scoped', allowScopedDependencies: false });
const descriptions = new WeakMap<object, ProviderDescription>();

export function sourceDescription(
  create: Factory,
  dispose?: (value: never) => void | Promise<void>,
  tokenKeys: readonly symbol[] = [],
  acquisitionMode: AcquisitionMode = 'auto',
  contextual = false,
  references: readonly ArgumentReference[] = [],
): ProviderDescription {
  const selected = Object.freeze([...tokenKeys]);
  const argumentsSnapshot = Object.freeze(references.map(reference => Object.freeze({ ...reference })));
  const source: SourceOperation = Object.freeze(dispose ? { kind: 'source', create, dispose, tokenKeys: selected, references: argumentsSnapshot, acquisitionMode, contextual } : { kind: 'source', create, tokenKeys: selected, references: argumentsSnapshot, acquisitionMode, contextual });
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
  throw libraryError('DI_BAG_INVALID_REGISTRATION', 'invalid factory registration', { operation: 'register' });
}

export function normalize(registration: unknown): {
  lifetime: LifetimePolicy;
  alias?: string | symbol;
  create: Factory;
  acquisitionMode: AcquisitionMode;
  tokenKeys: readonly symbol[];
  references: readonly ArgumentReference[];
  contextual: boolean;
  dispose?: (value: never) => void | Promise<void>;
  metadata: Readonly<object>;
  operations: readonly ProviderOperation[];
} {
  const description = describe(registration);
  const { create, dispose, tokenKeys, references, acquisitionMode, contextual } = description.source;
  const { metadata, operations, lifetime } = description;
  const alias = description.alias === undefined ? {} : { alias: description.alias };
  return dispose ? { ...alias, create, dispose, tokenKeys, references, acquisitionMode, metadata, operations, lifetime, contextual } : { ...alias, create, tokenKeys, references, acquisitionMode, metadata, operations, lifetime, contextual };
}
