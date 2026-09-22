import { diagnosticMessage, libraryError } from './errors';
import type { AcquisitionEventFields, LifecycleEvent } from './observers';
import { DiBagCleanupError } from './errors';
import type { CleanupFailure } from './errors';
import type { BindingGraph, BindingId, BindingKey } from './runtime';
import type { RegistrationSnapshot, AcquisitionSnapshot } from './inspection';
import { ProviderExecution, type DisposerStack, type CompletedExecution } from './provider-execution';
import type { RuntimeContext } from './acquisition-mode';
import { AcquisitionFamily } from './acquisition-family';
import type { AcquisitionId, AttemptIdentity } from './acquisition-family';
import type { AcquisitionContext, DisposerContext } from './acquisition-context';

interface Acquisition extends AttemptIdentity {
  readonly strictRoot: string | undefined;
  readonly transient: boolean;
  exposed: unknown;
  execution: ProviderExecution | CompletedExecution;
}

function freshCollectionView(value: unknown): readonly unknown[] {
  return Object.freeze([...(value as readonly unknown[])]);
}

/**
 * The reason a close() without a cause aborts with. Built once at load: an error
 * created inside close() keeps an unformatted stack whose frames retain the
 * closing callbacks, and through them the scope and its graph, on every signal an
 * application kept after the bag closed. It stays a plain `AbortError`, so its
 * legacy numeric `code` is what an automatic abort reason had; the message names
 * the diagnostic.
 */
const closingReason: DOMException = (() => {
  const reason = new DOMException(diagnosticMessage('DI_BAG_CLOSING', 'bag is closing'), 'AbortError');
  void reason.stack; // format the load-time frames now, so nothing is retained lazily
  return Object.freeze(reason);
})();

/** Mutable, runtime-local attempts. Binding descriptions never carry ownership. */
export class ScopeAcquisitions {
  readonly ownerId = Symbol('owner');
  private readonly cache = new Map<BindingId, Acquisition>();
  private readonly attempts = new Map<AcquisitionId, Acquisition>();
  private readonly retired = new Map<AcquisitionId, Promise<void>>();
  private readonly failures: (CleanupFailure & { sequence: number })[] = [];
  private invocationSequence = 0;
  // Insertion order is successful ownership acceptance order, including promises.
  private readonly owned = new Map<AcquisitionId, Acquisition>();
  private state: 'open' | 'closing' | 'closed' = 'open';
  private closing: Promise<void> | undefined;
  private controller: AbortController | undefined;
  private cancellationStarted = false;
  private cancellationCause: unknown;

  private readonly shared: ReadonlySet<BindingId>;
  private readonly family: AcquisitionFamily;

  constructor(
    private readonly graph: BindingGraph,
    private readonly context: RuntimeContext,
    private readonly parent?: ScopeAcquisitions,
    shared: readonly BindingId[] = [],
  ) {
    this.shared = new Set(shared);
    this.family = parent?.family ?? new AcquisitionFamily();
  }

  private owner(bindingId: BindingId): ScopeAcquisitions {
    if (this.parent && this.shared.has(bindingId)) return this.parent;
    if (this.graph.registration(bindingId).lifetime.kind !== 'root') return this;
    // A child override introduces a new identity absent from older graphs.
    // Inherited identities retain the earliest graph and its dependency context.
    let owner: ScopeAcquisitions = this;
    for (let ancestor = this.parent; ancestor; ancestor = ancestor.parent) {
      if (ancestor.graph.hasBinding(bindingId)) owner = ancestor;
    }
    return owner;
  }

  resolve(key: BindingKey): unknown {
    this.assertOpen();
    return this.takeExposed(this.resolveBinding(this.graph.publicBinding(key)));
  }

  private resolveContributions(key: symbol, from?: Acquisition): readonly unknown[] {
    return Object.freeze(this.graph.contributionBindings(key).map(id => this.takeExposed(this.resolveBinding(id, from))));
  }

  resolveCollection(key: symbol): readonly unknown[] {
    this.assertOpen();
    return this.graph.hasPublic(key)
      ? freshCollectionView(
          this.takeExposed(
            this.resolveBinding(this.graph.publicBinding(key)),
          ),
        )
      : this.resolveContributions(key);
  }

  async acquire(key: BindingKey): Promise<void> {
    this.assertOpen();
    const attempt = this.resolveBinding(this.graph.publicBinding(key));
    this.takeExposed(attempt);
    await attempt.execution.ready();
  }

  async acquireCollection(key: symbol): Promise<void> {
    this.assertOpen();
    const ids = this.graph.hasPublic(key) ? [this.graph.publicBinding(key)] : this.graph.contributionBindings(key);
    const attempts = ids.map(id => {
      const attempt = this.resolveBinding(id);
      this.takeExposed(attempt);
      return attempt;
    });
    await Promise.all(attempts.map(attempt => attempt.execution.ready()));
  }

  private takeExposed(attempt: Acquisition): unknown {
    const value = attempt.exposed;
    // Aliases and owner routing have already selected the canonical lifetime.
    if (attempt.transient) attempt.exposed = undefined;
    return value;
  }

  inspect(bindingId: BindingId, path: readonly BindingId[] = []): readonly AcquisitionSnapshot<readonly unknown[]>[] {
    if (this.parent && this.shared.has(bindingId)) return this.parent.inspect(bindingId, path);
    const alias = this.graph.registration(bindingId).alias;
    if (alias !== undefined) {
      this.assertAliasPath(bindingId, path);
      return this.inspect(this.graph.dependency(bindingId, alias), [...path, bindingId]);
    }
    const owner = this.owner(bindingId);
    if (owner !== this) return owner.inspect(bindingId);
    const snapshots: AcquisitionSnapshot<readonly unknown[]>[] = [];
    for (const attempt of this.attempts.values()) {
      if (attempt.bindingId !== bindingId) continue;
      snapshots.push(Object.freeze({
        acquisitionId: attempt.id,
        state: attempt.state,
        acquisitionMetadata: attempt.execution.inspectFrames(),
      }));
    }
    return Object.freeze(snapshots);
  }

  isTransient(bindingId: BindingId, path: readonly BindingId[] = []): boolean {
    if (this.parent && this.shared.has(bindingId)) return this.parent.isTransient(bindingId, path);
    const description = this.graph.registration(bindingId);
    if (description.alias === undefined) return description.lifetime.kind === 'transient';
    this.assertAliasPath(bindingId, path);
    return this.isTransient(this.graph.dependency(bindingId, description.alias), [...path, bindingId]);
  }

  /** Relationship uses the effective owner graph; frames use canonical attempts. */
  inspectDescription(bindingId: BindingId): Pick<RegistrationSnapshot<object, readonly unknown[]>, 'registrationMetadata' | 'aliasTarget'> {
    if (this.parent && this.shared.has(bindingId)) return this.parent.inspectDescription(bindingId);
    const description = this.graph.registration(bindingId);
    if (description.alias !== undefined) {
      const target = this.graph.dependency(bindingId, description.alias);
      return { registrationMetadata: description.metadata, aliasTarget: Object.freeze({ bindingId: target, label: this.graph.label(target) }) };
    }
    const owner = this.owner(bindingId);
    return owner === this ? { registrationMetadata: description.metadata } : owner.inspectDescription(bindingId);
  }

  observedEdges(): readonly { readonly from: BindingId; readonly to: BindingId }[] { return this.family.observedEdges(); }

  private assertAliasPath(bindingId: BindingId, path: readonly BindingId[]): void {
    if (path.includes(bindingId)) throw libraryError('DI_BAG_CYCLE', `alias cycle: ${[...path, bindingId].map(id => this.graph.label(id)).join(' -> ')}`, { path: Object.freeze([...path, bindingId].map(id => this.graph.label(id))) });
  }

  assertOpen(): void {
    if (this.state !== 'open') throw libraryError(this.state === 'closing' ? 'DI_BAG_CLOSING' : 'DI_BAG_CLOSED', `bag is ${this.state}`, { state: this.state });
  }

  close(beforeDispose?: Promise<void>, cause?: unknown): Promise<void> {
    if (this.closing) return this.closing;
    this.state = 'closing';
    // Publish the barrier before invoking any finalizer, including reentrant ones.
    this.closing = Promise.resolve().then(() => {
      // Every descendant admission gate is closed before abort listeners run.
      this.cancellationStarted = true;
      this.cancellationCause = cause === undefined ? closingReason : cause;
      this.controller?.abort(this.cancellationCause);
      return this.disposeAll(beforeDispose);
    });
    return this.closing;
  }

  /** Labels of this scope's running disposers and of acquisitions close is still draining. */
  collectProgress(pending: string[], acquiring: string[]): void {
    for (const attempt of this.attempts.values()) {
      if (attempt.state === 'disposing' || this.retired.has(attempt.id) || attempt.execution.rollingBack) pending.push(attempt.label);
      else if (attempt.state === 'creating' || attempt.state === 'pending') acquiring.push(attempt.label);
    }
  }

  /** One controller per scope; every acquisition observes the same cancellation. */
  private cancellationSignal(): AbortSignal {
    if (!this.controller) {
      this.controller = new AbortController();
      if (this.cancellationStarted) this.controller.abort(this.cancellationCause);
    }
    return this.controller.signal;
  }

  /**
   * The signal is scope-wide; deferred cleanup is local to this attempt, so each
   * contextual acquisition receives its own frozen context. The context captures
   * only its disposer stack, never the execution or this scope, so an
   * application that retains it past `close()` retains nothing else. Built here
   * rather than in `resolveBinding` for the same reason: every closure of a
   * function shares one scope, and a factory can retain the dependency proxy.
   */
  private acquisitionContext(disposers: DisposerStack): AcquisitionContext {
    return Object.freeze({
      signal: this.cancellationSignal(),
      pushDisposer: (disposer: (this: void, disposerContext: DisposerContext) => void | Promise<void>) => { disposers.push(disposer); },
    });
  }

  private resolveBinding(bindingId: BindingId, from?: Acquisition, path: readonly BindingId[] = []): Acquisition {
    // Sharing an alias borrows its lexical parent graph before following targets.
    if (this.parent && this.shared.has(bindingId)) return this.parent.resolveBinding(bindingId, from, path);
    const description = this.graph.registration(bindingId);
    if (description.alias !== undefined) {
      this.assertAliasPath(bindingId, path);
      return this.resolveBinding(this.graph.dependency(bindingId, description.alias), from, [...path, bindingId]);
    }
    const { lifetime } = description;
    // Validate before routing/cache lookup; retained proxies keep their boundary.
    if (lifetime.kind === 'scoped' && from?.strictRoot !== undefined) {
      throw libraryError('DI_BAG_LIFETIME_DEPENDENCY', `root lifetime cannot capture scoped dependency: ${from.strictRoot} -> ${this.graph.label(bindingId)}`, { consumer: from.strictRoot, dependency: this.graph.label(bindingId), lifetime: 'root' });
    }
    const owner = this.owner(bindingId);
    if (owner !== this) return owner.resolveBinding(bindingId, from);
    const cached = this.cache.get(bindingId);
    if (cached) {
      if (from) this.family.recordEdge(from, cached);
      // A factory or then getter can reenter through public resolve as well.
      if (cached.state === 'creating') this.family.ancestry(bindingId, this.ownerId, cached.label, from);
      return cached;
    }
    const ancestry = this.family.ancestry(bindingId, this.ownerId, this.graph.label(bindingId), from);
    const execution = new ProviderExecution({
      accepted: () => { this.owned.set(attempt.id, attempt); },
      settled: () => {
        if (attempt.execution.state === 'failed') {
          this.observeAttempt(attempt, 'acquisition-failed', attempt.execution.error);
          this.retire(attempt);
        } else {
          attempt.state = 'ready';
          this.family.deactivate(attempt);
          this.observeAttempt(attempt, 'acquisition-ready');
        }
      },
      drained: () => {
        if (attempt.execution instanceof ProviderExecution) attempt.execution = attempt.execution.compact();
      },
      ...(this.context.observers ? {
        cleanupStarted: () => this.observeAttempt(attempt, 'cleanup-started'),
        cleanupCompleted: (outcome: 'success' | 'failure') => {
          this.context.observers!.emit({ ...this.eventFields(attempt), kind: 'cleanup-completed', outcome });
        },
      } : {}),
      invoking: () => this.invocationSequence++,
      cleanupFailed: (sequence, error) => {
        if (this.context.observers) this.context.observers.emit({ ...this.eventFields(attempt), kind: 'cleanup-failed', disposalSequence: sequence, error });
        this.failures.push({ sequence, acquisitionId: attempt.id, bindingId: attempt.bindingId, label: attempt.label, error });
      },
    }, description, this.context);
    const attempt: Acquisition = {
      id: Symbol(this.graph.label(bindingId)),
      bindingId,
      ownerId: this.ownerId,
      label: this.graph.label(bindingId),
      dependencies: new Set(),
      ancestry,
      strictRoot: lifetime.kind === 'root'
        ? lifetime.allowScopedDependencies ? undefined : this.graph.label(bindingId)
        : from?.strictRoot,
      state: 'creating',
      transient: lifetime.kind === 'transient',
      exposed: undefined,
      execution,
    };
    if (lifetime.kind !== 'transient') this.cache.set(bindingId, attempt);
    this.attempts.set(attempt.id, attempt);
    this.family.add(attempt);
    if (from) this.family.recordEdge(from, attempt);
    const read = (
      key: BindingKey,
      optional = false,
      isCollection = false,
    ): unknown => {
      // Only this attempt's in-flight factory can discover dependencies in close.
      if (this.state === 'closed' || (this.state === 'closing' && !attempt.execution.sourceInFlight)) {
        throw libraryError(this.state === 'closing' ? 'DI_BAG_CLOSING' : 'DI_BAG_CLOSED', `bag is ${this.state}`, { state: this.state });
      }
      const target = this.graph.findDependency(bindingId, key);
      if (isCollection) {
        return target === undefined
          ? this.resolveContributions(key as symbol, attempt)
          : freshCollectionView(
              this.takeExposed(this.resolveBinding(target, attempt)),
            );
      }
      if (target === undefined && !optional) {
        const path = this.family.dependencyPath(attempt, String(key));
        throw libraryError('DI_BAG_MISSING_DEPENDENCY', `Cannot resolve ${JSON.stringify(attempt.label)}: dependency ${JSON.stringify(String(key))} is not registered. Resolution path: ${path.join(' -> ')}.`, { operation: 'resolve', consumer: attempt.label, dependency: key, path });
      }
      return target === undefined ? undefined : this.takeExposed(this.resolveBinding(target, attempt));
    };
    const references = new Map(description.references.map(reference => [reference.slot, reference]));
    const invalidAccess = (access: string) => libraryError(
      'DI_BAG_INVALID_DEPENDENCY_ACCESS',
      `Cannot inspect the dependencies of ${JSON.stringify(attempt.label)}: ${access} is not supported. Read each named dependency directly; the dependency object resolves lazily.`,
      { operation: 'resolve', consumer: attempt.label, access },
    );
    const dependencyProxy = new Proxy(Object.create(null) as Record<string, unknown>, {
      get: (_, key) => {
        // JSON.stringify probes toJSON through get before enumerating; name the real operation.
        if (key === 'toJSON') throw invalidAccess('JSON.stringify');
        const reference = typeof key === 'symbol' ? references.get(key) : undefined;
        if (reference) {
          return reference.kind === 'lazy'
            ? () => read(reference.key, false, reference.isCollection)
            : read(
                reference.key,
                reference.kind === 'optional',
                reference.isCollection,
              );
        }
        if (typeof key === 'symbol' && !description.tokenKeys.includes(key)) return undefined;
        return read(key);
      },
      // Only `get` is lazy and checked; every other reflection would silently report an empty object.
      has: (_, key) => { throw invalidAccess(`'${String(key)}' in deps`); },
      ownKeys: () => { throw invalidAccess('enumeration (Object.keys, spread, JSON.stringify)'); },
      getOwnPropertyDescriptor: (_, key) => { throw invalidAccess(`descriptor of '${String(key)}'`); },
    });
    this.observeAttempt(attempt, 'acquisition-started');
    this.family.enter(attempt);
    const directSource = !description.contextual && !description.operations.length;
    const { disposers } = execution;
    try {
      let value: unknown;
      if (directSource) {
        const { create } = description;
        value = create(dependencyProxy as never);
        execution.publishSource(value, description);
      } else {
        value = execution.evaluate(description, dependencyProxy, disposers && this.acquisitionContext(disposers));
      }
      attempt.exposed = value;
      attempt.state = attempt.execution.state;
      if (attempt.state === 'ready') {
        this.family.deactivate(attempt);
        this.observeAttempt(attempt, 'acquisition-ready');
      }
      attempt.execution = execution.compact();
      return attempt;
    } catch (error) {
      if (directSource) execution.sourceInFlight = false;
      this.observeAttempt(attempt, 'acquisition-failed', error);
      this.retire(attempt);
      throw error;
    } finally {
      this.family.leave();
    }
  }

  private eventFields(attempt: Acquisition): AcquisitionEventFields {
    const description = this.graph.registration(attempt.bindingId);
    return {
      scopeId: this.ownerId, bindingId: attempt.bindingId, acquisitionId: attempt.id,
      label: attempt.label, lifetime: description.lifetime.kind,
      registrationMetadata: Object.freeze({ ...description.metadata }), acquisitionMetadata: attempt.execution.inspectFrames(),
    };
  }

  private observeAttempt(attempt: Acquisition, kind: 'acquisition-started' | 'acquisition-ready' | 'acquisition-failed' | 'cleanup-started', error?: unknown): void {
    if (!this.context.observers) return;
    const fields = this.eventFields(attempt);
    const event: LifecycleEvent = kind === 'acquisition-failed' ? { ...fields, kind, error } : { ...fields, kind };
    this.context.observers.emit(event);
  }

  private retire(attempt: Acquisition): void {
    if (this.cache.get(attempt.bindingId) === attempt) this.cache.delete(attempt.bindingId);
    attempt.state = 'failed';
    this.family.deactivate(attempt);
    attempt.exposed = undefined;
    // No consumer acquired this failed exposed value. Keep this attempt's
    // outgoing edges and pending work, but abandon unsuccessful incoming reads.
    this.family.retireIncoming(attempt);
    if (this.retired.has(attempt.id)) return;
    const release = () => {
      this.family.release(attempt);
      attempt.dependencies.clear();
      attempt.execution.release();
      this.attempts.delete(attempt.id);
      this.owned.delete(attempt.id);
      this.retired.delete(attempt.id);
    };
    // Incoming IDs may dangle; never substitute a cached retry's identity.
    if (!attempt.execution.hasOwnership && !attempt.execution.work.length) { release(); return; }
    const cleanup = attempt.execution.dispose().then(release);
    this.retired.set(attempt.id, cleanup);
  }

  private async disposeAll(beforeDispose?: Promise<void>): Promise<void> {
    let failures: CleanupFailure[] = [];
    try {
      if (beforeDispose) await beforeDispose;
      // Sources and projections can still acquire dependencies or retire work.
      while (true) {
        const work = [...this.retired.values(), ...[...this.attempts.values()].flatMap(attempt => attempt.execution.work)];
        if (!work.length) break;
        await Promise.all(work);
      }
      const ordered: Acquisition[] = [];
      const visited = new Set<AcquisitionId>();
      const stack: { attempt: Acquisition; dependencies: SetIterator<AcquisitionId> }[] = [];
      const enter = (id: AcquisitionId) => {
        if (visited.has(id)) return;
        visited.add(id);
        const attempt = this.attempts.get(id);
        if (!attempt) return;
        stack.push({ attempt, dependencies: attempt.dependencies.values() });
      };
      // Explicit DFS frames preserve dependency/insertion order without using
      // the JavaScript call stack for a potentially deep acquisition graph.
      for (const id of this.owned.keys()) {
        enter(id);
        while (stack.length) {
          const frame = stack[stack.length - 1]!;
          const next = frame.dependencies.next();
          if (!next.done) { enter(next.value); continue; }
          stack.pop();
          if (frame.attempt.execution.hasOwnership) ordered.push(frame.attempt);
        }
      }
      for (const attempt of ordered.reverse()) {
        attempt.state = 'disposing';
        await attempt.execution.dispose();
        attempt.state = 'disposed';
      }
      failures = [...this.failures].sort((a, b) => a.sequence - b.sequence)
        .map(({ acquisitionId, bindingId, label, error }) => ({ acquisitionId, bindingId, label, error }));
    } finally {
      this.state = 'closed';
      for (const attempt of this.attempts.values()) {
        this.family.retireIncoming(attempt);
        this.family.release(attempt);
        attempt.dependencies.clear();
        attempt.exposed = undefined;
        attempt.execution.release();
      }
      this.cache.clear();
      this.attempts.clear();
      this.retired.clear();
      this.failures.length = 0;
      this.owned.clear();
    }
    if (failures.length > 0) throw new DiBagCleanupError(failures);
  }
}
