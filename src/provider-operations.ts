import type { Factory } from './registration';

interface SourceOperation {
  readonly kind: 'source';
  readonly create: Factory;
  readonly dispose?: (value: never) => void | Promise<void>;
}
interface MetadataOperation {
  readonly kind: 'metadata';
  readonly metadata: Readonly<object>;
}
export interface ProviderDescription {
  readonly source: SourceOperation;
  readonly operations: readonly MetadataOperation[];
  readonly metadata: Readonly<object>;
}

const emptyMetadata = Object.freeze({});
const descriptions = new WeakMap<object, ProviderDescription>();

export function sourceDescription(
  create: Factory,
  dispose?: (value: never) => void | Promise<void>,
): ProviderDescription {
  const source: SourceOperation = Object.freeze(dispose ? { kind: 'source', create, dispose } : { kind: 'source', create });
  return Object.freeze({ source, operations: Object.freeze([]), metadata: emptyMetadata });
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
  create: Factory;
  dispose?: (value: never) => void | Promise<void>;
  metadata: Readonly<object>;
} {
  const description = describe(registration);
  const { create, dispose } = description.source;
  return dispose ? { create, dispose, metadata: description.metadata } : { create, metadata: description.metadata };
}
