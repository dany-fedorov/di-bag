import type { FactoryReturnKind } from './acquisition-mode';
import type { Lifetime } from './lifetime';

/**
 * Structural optional presence; payloads are application-owned and not frozen.
 * @see https://dany-fedorov.github.io/di-bag/guides/tutorial.html#attach-metadata-and-inspect-without-resolving
 */
export type Presence<T> = { readonly isPresent: false } | { readonly isPresent: true; readonly value: T };

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
 * A frozen binding description and copied acquisition state returned by container inspection.
 * @see https://dany-fedorov.github.io/di-bag/guides/tutorial.html#attach-metadata-and-inspect-without-resolving
 */
export interface RegistrationSnapshot<M = Readonly<{}>, A extends readonly unknown[] = readonly []> {
  /** Stable identity for the canonical graph binding. */
  readonly bindingId: symbol;
  /** Human-readable binding label. */
  readonly bindingLabel: string;
  /** Direct lexical target; acquisition snapshots follow the canonical target. */
  readonly aliasTarget?: { readonly bindingId: symbol; readonly bindingLabel: string };
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
  /** Innermost module installation that introduced this binding; absent for host declarations and host replacements. */
  readonly moduleInstallationId: symbol | undefined;
  /** Public names or token symbols that select this binding, in service key order; empty for a private module binding. */
  readonly serviceKeys: readonly (string | symbol)[];
  readonly lifetime: Lifetime;
  readonly factoryReturnKind: FactoryReturnKind;
  /** True when some stage of the provider accepts ownership through a disposer. */
  readonly isOwnedByContainer: boolean;
  /** Typed-token dependencies declared positionally through service tokens, collection tokens, `optional`, or `lazy` references. */
  readonly tokenDependencies: readonly { readonly tokenSymbol: symbol; readonly dependencyKind: 'required' | 'optional' | 'lazy' }[];
}

/** One occurrence of a sealed module in a container graph. */
export interface ModuleInstallationSnapshot {
  /** Stable identity for this occurrence in the graph. */
  readonly installationId: symbol;
  /** Exact label supplied when the module was sealed, if any. */
  readonly moduleLabel: string | undefined;
  /** Enclosing installation, if this module was installed inside another module. */
  readonly parentInstallationId: symbol | undefined;
}

/**
 * A frozen description of every binding a container can resolve, plus the edges observed so far.
 * Named dependencies read from a factory's object parameter are not knowable until the factory
 * runs; `observedEdges` records them after acquisition. Use the static graph tool for declared edges.
 * @see https://dany-fedorov.github.io/di-bag/guides/tutorial.html#attach-metadata-and-inspect-without-resolving
 */
export interface GraphSnapshot {
  readonly containerId: symbol;
  /** Module occurrences in installation order, with each parent preceding its contiguous descendants. */
  readonly moduleInstallations: readonly ModuleInstallationSnapshot[];
  /** Public bindings in service key order, then contributions in group order, then remaining private bindings. */
  readonly bindings: readonly BindingSnapshot<object, readonly unknown[]>[];
  readonly contributions: readonly { readonly collectionTokenSymbol: symbol; readonly bindingIds: readonly symbol[] }[];
  /** Consumer-to-dependency edges recorded by acquisitions in this container's ownership family. */
  readonly observedEdges: readonly { readonly consumerBindingId: symbol; readonly dependencyBindingId: symbol }[];
}
