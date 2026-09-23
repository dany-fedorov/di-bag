import type { FactoryReturnKind } from './acquisition-mode';
import type { Lifetime } from './lifetime';

/**
 * Structural optional presence; payloads are application-owned and not frozen.
 * @see https://dany-fedorov.github.io/di-bag/guides/tutorial.html#attach-metadata-and-inspect-without-resolving
 */
export type Presence<T> = { readonly present: false } | { readonly present: true; readonly value: T };

/**
 * A readonly tuple indicating whether each acquisition-stage frame is available.
 * @see https://dany-fedorov.github.io/di-bag/guides/tutorial.html#attach-metadata-and-inspect-without-resolving
 */
export type AcquisitionMetadataPresence<A extends readonly unknown[]> = {
  readonly [I in keyof A]: Presence<A[I]>;
};

/**
 * A frozen point-in-time view of one acquisition attempt.
 * @see https://dany-fedorov.github.io/di-bag/guides/tutorial.html#attach-metadata-and-inspect-without-resolving
 */
export interface AcquisitionSnapshot<A extends readonly unknown[] = readonly []> {
  /** Stable identity for this attempt; retries receive a new symbol. */
  readonly acquisitionId: symbol;
  /** State at the instant the snapshot was copied. */
  readonly state: 'creating' | 'pending' | 'ready' | 'failed' | 'disposing' | 'disposed';
  /** Ordered presence records for metadata captured during acquisition. */
  readonly acquisitionMetadata: AcquisitionMetadataPresence<A>;
}

/**
 * A frozen registration description and copied acquisition state returned by container inspection.
 * @see https://dany-fedorov.github.io/di-bag/guides/tutorial.html#attach-metadata-and-inspect-without-resolving
 */
export interface RegistrationSnapshot<M = Readonly<{}>, A extends readonly unknown[] = readonly []> {
  /** Stable identity for the canonical graph binding. */
  readonly bindingId: symbol;
  /** Human-readable binding label. */
  readonly label: string;
  /** Direct lexical target; acquisition snapshots follow the canonical target. */
  readonly aliasTarget?: { readonly bindingId: symbol; readonly label: string };
  /** Static registration metadata; application-owned payload values retain their identity. */
  readonly registrationMetadata: Readonly<M>;
  /** Point-in-time attempts; inspection does not retain failed-attempt history. */
  readonly acquisitions: readonly AcquisitionSnapshot<A>[];
}

/**
 * One binding of a container's graph, described without acquiring it.
 * @see https://dany-fedorov.github.io/di-bag/guides/tutorial.html#attach-metadata-and-inspect-without-resolving
 */
export interface BindingSnapshot<M = Readonly<{}>, A extends readonly unknown[] = readonly []> extends RegistrationSnapshot<M, A> {
  /** Public names or token symbols that select this binding, in registration order; empty for a private module binding. */
  readonly keys: readonly (string | symbol)[];
  readonly lifetime: Lifetime;
  readonly factoryReturnKind: FactoryReturnKind;
  /** True when some stage of the provider accepts ownership through a disposer. */
  readonly owned: boolean;
  /** Typed-token dependencies declared positionally through service tokens, collection tokens, `optional`, or `lazy` references. */
  readonly tokenDependencies: readonly { readonly key: symbol; readonly kind: 'required' | 'optional' | 'lazy' }[];
}

/**
 * A frozen description of every binding a container can resolve, plus the edges observed so far.
 * Named dependencies read from a factory's object parameter are not knowable until the factory
 * runs; `observedEdges` records them after acquisition. Use the static graph tool for declared edges.
 * @see https://dany-fedorov.github.io/di-bag/guides/tutorial.html#attach-metadata-and-inspect-without-resolving
 */
export interface GraphSnapshot {
  readonly scopeId: symbol;
  /** Public bindings in registration order, then contributions in group order, then remaining private bindings. */
  readonly bindings: readonly BindingSnapshot<object, readonly unknown[]>[];
  readonly contributions: readonly { readonly token: symbol; readonly bindingIds: readonly symbol[] }[];
  /** Consumer-to-dependency edges recorded by acquisitions in this container's ownership family. */
  readonly observedEdges: readonly { readonly from: symbol; readonly to: symbol }[];
}
