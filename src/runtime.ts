import { Acquisitions } from './acquisition';
import { DiBagCleanupError } from './errors';
import type { CleanupFailure } from './errors';
import { normalize } from './registration';
import type { Registration, Registrations } from './registration';
import type { InspectionSnapshot } from './inspection';
import { requireClassificationCapability } from './acquisition-mode';
import type { RuntimeContext } from './acquisition-mode';

export type BindingId = symbol;
export type BindingKey = string | symbol;
export type BindingRef =
  | { readonly kind: 'private'; readonly id: BindingId }
  | { readonly kind: 'public'; readonly key: BindingKey };

export interface BindingDescription {
  readonly id: BindingId;
  readonly label: string;
  readonly registration: Registration;
  readonly localNames: ReadonlyMap<BindingKey, BindingRef>;
}

export interface GraphDescription {
  readonly bindings: ReadonlyMap<BindingId, BindingDescription>;
  readonly publicSlots: ReadonlyMap<BindingKey, BindingId>;
  readonly contributions?: ReadonlyMap<symbol, readonly BindingId[]>;
}

type Normalized = Readonly<ReturnType<typeof normalize>>;

/** Immutable descriptions: input maps are copied and retained maps never escape. */
export class BindingGraph {
  readonly #bindings = new Map<BindingId, BindingDescription>();
  readonly #registrations = new Map<BindingId, Normalized>();
  readonly #publicSlots: Map<BindingKey, BindingId>;
  readonly #contributions = new Map<symbol, readonly BindingId[]>();
  #explicitlyClassified = false;

  constructor(description: GraphDescription = { bindings: new Map(), publicSlots: new Map() }) {
    const lexicalSnapshots = new Map<BindingDescription['localNames'], BindingDescription['localNames']>();
    for (const [id, binding] of description.bindings) {
      let localNames = lexicalSnapshots.get(binding.localNames);
      if (!localNames) {
        localNames = new Map([...binding.localNames].map(([name, ref]) => [name, Object.freeze({ ...ref })]));
        lexicalSnapshots.set(binding.localNames, localNames);
      }
      this.#bindings.set(id, Object.freeze({
        id: binding.id,
        label: binding.label,
        registration: binding.registration,
        localNames,
      }));
      this.#registrations.set(id, Object.freeze(normalize(binding.registration)));
    }
    this.#publicSlots = new Map(description.publicSlots);
    for (const [key, ids] of description.contributions ?? []) this.#contributions.set(key, Object.freeze([...ids]));
  }

  /** Reuse encapsulated snapshots; only the lookup tables need new ownership. */
  private copy(): BindingGraph {
    const graph = new BindingGraph();
    for (const [id, binding] of this.#bindings) graph.#bindings.set(id, binding);
    for (const [id, registration] of this.#registrations) graph.#registrations.set(id, registration);
    for (const [key, id] of this.#publicSlots) graph.#publicSlots.set(key, id);
    for (const [key, ids] of this.#contributions) graph.#contributions.set(key, ids);
    return graph;
  }

  private addBinding(label: string, registration: Registration): BindingId {
    const id = Symbol(label);
    this.#bindings.set(id, Object.freeze({ id, label, registration, localNames: new Map() }));
    this.#registrations.set(id, Object.freeze(normalize(registration)));
    return id;
  }

  contributionBindings(key: symbol): readonly BindingId[] {
    return this.#contributions.get(key) ?? Object.freeze([]);
  }

  withContribution(key: symbol, registration: Registration): BindingGraph {
    const graph = this.copy();
    const id = graph.addBinding(`contribution:${String(key)}`, registration);
    graph.#contributions.set(key, Object.freeze([...this.contributionBindings(key), id]));
    return graph;
  }

  hasPublic(key: BindingKey): boolean {
    return this.#publicSlots.has(key);
  }

  hasBinding(id: BindingId): boolean {
    return this.#bindings.has(id);
  }

  /** Immutable graphs need explicit-mode validation only once; configured forks are O(1). */
  preflight(context: RuntimeContext): void {
    if (context.isNativePromise || this.#explicitlyClassified) return;
    for (const description of this.#registrations.values()) {
      requireClassificationCapability([description.acquisition, ...description.operations.flatMap(operation =>
        'acquisition' in operation ? [operation.acquisition] : [])], context);
    }
    this.#explicitlyClassified = true;
  }

  publicBinding(key: BindingKey): BindingId {
    const id = this.#publicSlots.get(key);
    if (id === undefined) throw new Error(`no factory for ${String(key)}`);
    return id;
  }

  findDependency(from: BindingId, localName: BindingKey): BindingId | undefined {
    const ref = this.#bindings.get(from)?.localNames.get(localName);
    return ref?.kind === 'private' ? ref.id : this.#publicSlots.get(ref?.key ?? localName);
  }

  dependency(from: BindingId, localName: BindingKey): BindingId {
    const ref = this.#bindings.get(from)?.localNames.get(localName);
    return ref?.kind === 'private' ? ref.id : this.publicBinding(ref?.key ?? localName);
  }

  registration(id: BindingId): Normalized {
    const registration = this.#registrations.get(id);
    if (!registration) throw new Error(`no factory for ${this.label(id)}`);
    return registration;
  }

  label(id: BindingId): string {
    return this.#bindings.get(id)?.label ?? String(id);
  }

  /** Replacing a public slot preserves existing bindings and their lexical refs. */
  withPublicRegistrations(registrations: Registrations): BindingGraph {
    return this.withPublicBindings(Object.keys(registrations).map(key => [key, registrations[key]!]));
  }

  /** Replace ordered string or symbol slots in one immutable graph reconstruction. */
  withPublicBindings(entries: readonly (readonly [BindingKey, Registration])[]): BindingGraph {
    if (entries.length === 0) return this;
    const graph = this.copy();
    for (const [key, registration] of entries) {
      const id = graph.addBinding(String(key), registration);
      graph.#publicSlots.set(key, id);
    }
    return graph;
  }

  /** Replace one public slot, preserving lexical references and symbol identity. */
  withPublicBinding(key: BindingKey, registration: Registration): BindingGraph {
    return this.withPublicBindings([[key, registration]]);
  }

  /** Install disjoint public slots atomically, retaining lexical private refs. */
  withInstallation(description: GraphDescription): BindingGraph {
    for (const key of description.publicSlots.keys()) {
      if (this.#publicSlots.has(key)) throw new Error(`duplicate registration: ${String(key)}`);
    }
    const installation = new BindingGraph(description);
    const graph = this.copy();
    for (const [id, binding] of installation.#bindings) graph.#bindings.set(id, binding);
    for (const [id, registration] of installation.#registrations) graph.#registrations.set(id, registration);
    for (const [key, id] of installation.#publicSlots) graph.#publicSlots.set(key, id);
    for (const [key, ids] of installation.#contributions) {
      graph.#contributions.set(key, Object.freeze([...this.contributionBindings(key), ...ids]));
    }
    return graph;
  }
}

/** Each runtime owns its acquisitions; immutable descriptions remain reusable. */
export class Runtime {
  private readonly acquisitions: Acquisitions;
  private readonly children = new Set<Runtime>();
  private closing: Promise<void> | undefined;

  constructor(
    private readonly graph: BindingGraph,
    private readonly context: RuntimeContext,
    private detach: (() => void) | undefined = undefined,
    private readonly parentAcquisitions?: Acquisitions,
    shared: readonly BindingId[] = [],
  ) {
    graph.preflight(context);
    this.acquisitions = new Acquisitions(graph, context, parentAcquisitions, shared);
    this.observeScope('scope-opened');
  }

  resolve(key: BindingKey): unknown {
    return this.acquisitions.resolve(key);
  }

  resolveAll(key: symbol): readonly unknown[] { return this.acquisitions.resolveAll(key); }

  inspectAll(key: symbol): readonly InspectionSnapshot<object, readonly unknown[]>[] {
    return Object.freeze(this.graph.contributionBindings(key).map(bindingId => this.inspectBinding(bindingId)));
  }

  acquire(key: BindingKey): Promise<void> {
    return this.acquisitions.acquire(key);
  }

  isTransient(key: BindingKey): boolean {
    return this.acquisitions.isTransient(this.graph.publicBinding(key));
  }

  inspect(key: BindingKey): InspectionSnapshot<object, readonly unknown[]> {
    return this.inspectBinding(this.graph.publicBinding(key));
  }

  private inspectBinding(bindingId: BindingId): InspectionSnapshot<object, readonly unknown[]> {
    return Object.freeze({
      bindingId,
      label: this.graph.label(bindingId),
      ...this.acquisitions.inspectDescription(bindingId),
      acquisitions: this.acquisitions.inspect(bindingId),
    });
  }

  assertOpen(): void {
    if (this.closing) throw new Error('bag is closing');
    this.acquisitions.assertOpen();
  }

  scope(graph: BindingGraph = this.graph, shared: readonly BindingId[] = []): Runtime {
    this.assertOpen();
    let child!: Runtime;
    child = new Runtime(graph, this.context, () => { this.children.delete(child); }, this.acquisitions, shared);
    this.children.add(child);
    return child;
  }

  close(cause?: unknown): Promise<void> {
    if (this.closing) return this.closing;
    let fulfill!: () => void;
    let reject!: (error: unknown) => void;
    const closing = new Promise<void>((resolve, fail) => { fulfill = resolve; reject = fail; });
    // Publish before recursively closing children or starting local cleanup.
    this.closing = closing;
    this.observeScope('scope-closing');

    const childClosing = [...this.children].map(child => {
      try { return child.close(cause); }
      catch (error) { return Promise.reject(error); }
    });
    const childResults = Promise.allSettled(childClosing);
    let localClosing: Promise<void>;
    try {
      localClosing = this.acquisitions.close(
        childClosing.length > 0 ? childResults.then(() => undefined) : undefined,
        cause,
      );
    }
    catch (error) { localClosing = Promise.reject(error); }
    void this.finishClose(childResults, localClosing).then(
      () => { fulfill(); this.observeScope('scope-closed'); },
      error => { reject(error); this.observeScope('scope-close-failed', error); },
    );

    const detach = this.detach;
    this.detach = undefined;
    if (detach) void closing.then(
      () => { detach(); },
      () => { detach(); },
    );
    return closing;
  }

  private observeScope(kind: 'scope-opened' | 'scope-closing' | 'scope-closed' | 'scope-close-failed', error?: unknown): void {
    if (!this.context.observers) return;
    const fields = {
      scopeId: this.acquisitions.ownerId,
      ...(this.parentAcquisitions ? { parentScopeId: this.parentAcquisitions.ownerId } : {}),
    };
    this.context.observers.emit(kind === 'scope-close-failed' ? { ...fields, kind, error } : { ...fields, kind });
  }

  private async finishClose(
    childResults: Promise<PromiseSettledResult<void>[]>,
    localClosing: Promise<void>,
  ): Promise<void> {
    const [children, local] = await Promise.all([
      childResults,
      localClosing.then(
        () => ({ status: 'fulfilled' as const, value: undefined }),
        reason => ({ status: 'rejected' as const, reason }),
      ),
    ]);
    const failures: CleanupFailure[] = [];
    const unexpected: unknown[] = [];
    for (const result of [...children, local]) {
      if (result.status === 'fulfilled') continue;
      if (result.reason instanceof DiBagCleanupError) failures.push(...result.reason.failures);
      else unexpected.push(result.reason);
    }
    if (unexpected.length > 0) {
      const errors = failures.length > 0
        ? [new DiBagCleanupError(failures), ...unexpected]
        : unexpected;
      throw new AggregateError(errors, `Failed to close ${errors.length} runtime operation(s)`);
    }
    if (failures.length > 0) throw new DiBagCleanupError(failures);
  }
}
