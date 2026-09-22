import { diagnostic, diagnosticMessage, libraryError } from './errors';
import { ScopeAcquisitions } from './acquisition';
import { PersistentMap } from './persistent-map';
import { append, materialize } from './persistent-sequence';
import type { Sequence } from './persistent-sequence';
import { DiBagCleanupError } from './errors';
import type { CleanupFailure } from './errors';
import { normalize } from './registration';
import type { Registration, Registrations } from './registration';
import type { GraphSnapshot, RegistrationSnapshot } from './inspection';
import { classifierRequired, resolveClassifier } from './acquisition-mode';
import type { RuntimeContext } from './acquisition-mode';
import { wrongTokenKind, type TokenKind } from './tokens';

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
  readonly tokenKinds?: ReadonlyMap<symbol, TokenKind>;
}

type Normalized = Readonly<ReturnType<typeof normalize>>;

type LexicalSnapshot = {
  readonly id: symbol;
  readonly names: ReadonlyMap<BindingKey, BindingRef>;
  readonly privateIds: readonly BindingId[];
};
type BindingEntry = {
  readonly description: BindingDescription;
  readonly normalized: Normalized;
  readonly lexical?: LexicalSnapshot;
};
const emptyContributions: readonly BindingId[] = Object.freeze([]);
const emptyNames: ReadonlyMap<BindingKey, BindingRef> = new Map();

/** Immutable descriptions and path-copied lookup storage. Retained maps never escape. */
export class BindingGraph {
  #bindings = new PersistentMap<BindingEntry>();
  #publicSlots = new PersistentMap<BindingId>();
  #publicReferences = new PersistentMap<number>();
  #lexicalUsers = new PersistentMap<number>();
  #privateReferences = new PersistentMap<number>();
  #contributed = new PersistentMap<true>();
  // Only former public bindings are candidates; constructor-only private
  // registrations remain available to whole-graph preflight.
  #obsolete = new PersistentMap<true>();
  #contributions = new PersistentMap<Sequence<BindingId>>();
  // Counts cover retained positional bindings plus one direct owner for any
  // public token slot or contribution group; only positional owners are pruned.
  #tokenKinds = new PersistentMap<TokenKind>();
  #tokenKindOwners = new PersistentMap<number>();
  #directTokenKinds = new PersistentMap<true>();
  // First public registration order by key, for module snapshots. Keys are
  // never unregistered, so this retains nothing a graph would otherwise drop.
  #publicOrder: Sequence<BindingKey> | undefined;
  readonly #bindingCache = new Map<BindingId, BindingDescription>();
  readonly #registrationCache = new Map<BindingId, Normalized>();
  readonly #publicCache = new Map<BindingKey, BindingId>();
  readonly #contributionCache = new Map<symbol, readonly BindingId[]>();
  #explicitlyClassified = false;

  constructor(description: GraphDescription = { bindings: new Map(), publicSlots: new Map() }) {
    const declaredKinds = description.tokenKinds ?? new Map<symbol, TokenKind>();
    const lexicalSnapshots = new Map<BindingDescription['localNames'], LexicalSnapshot>();
    for (const [id, binding] of description.bindings) {
      let lexical = lexicalSnapshots.get(binding.localNames);
      if (!lexical) {
        const snapshot = new Map<BindingKey, BindingRef>();
        const privateIds: BindingId[] = [];
        for (const [name, ref] of binding.localNames) {
          const copiedRef = Object.freeze({ ...ref });
          snapshot.set(name, copiedRef);
          if (copiedRef.kind === 'private') privateIds.push(copiedRef.id);
        }
        lexical = { id: Symbol('lexical'), names: snapshot, privateIds };
        lexicalSnapshots.set(binding.localNames, lexical);
        for (const target of privateIds) this.#privateReferences = this.#privateReferences.set(target, (this.#privateReferences.get(target) ?? 0) + 1);
      }
      this.#lexicalUsers = this.#lexicalUsers.set(lexical.id, (this.#lexicalUsers.get(lexical.id) ?? 0) + 1);
      const entry: BindingEntry = {
        lexical,
        description: Object.freeze({ id: binding.id, label: binding.label, registration: binding.registration, localNames: lexical.names }),
        normalized: Object.freeze(normalize(binding.registration)),
      };
      this.retainBindingTokenKinds(entry, 'withInstalledModules');
      this.#bindings = this.#bindings.set(id, entry);
    }
    for (const [key, id] of description.publicSlots) {
      if (typeof key === 'symbol') {
        const kind = declaredKinds.get(key);
        if (kind !== undefined) this.claimTokenKind(key, kind, 'withInstalledModules');
      }
      this.#publicOrder = append(this.#publicOrder, { values: [key] });
      this.#publicSlots = this.#publicSlots.set(key, id);
      this.#publicReferences = this.#publicReferences.set(id, (this.#publicReferences.get(id) ?? 0) + 1);
    }
    for (const [key, ids] of description.contributions ?? []) {
      this.claimTokenKind(key, 'collection', 'withInstalledModules');
      const snapshot = Object.freeze([...ids]);
      this.#contributions = this.#contributions.set(key, { values: snapshot });
      for (const id of snapshot) this.#contributed = this.#contributed.set(id, true);
    }
  }

  /** Share only storage roots. Caches never retain ancestor wrappers or old arrays. */
  private copy(): BindingGraph {
    const graph = new BindingGraph();
    graph.#bindings = this.#bindings;
    graph.#publicSlots = this.#publicSlots;
    graph.#publicReferences = this.#publicReferences;
    graph.#lexicalUsers = this.#lexicalUsers;
    graph.#privateReferences = this.#privateReferences;
    graph.#contributed = this.#contributed;
    graph.#obsolete = this.#obsolete;
    graph.#contributions = this.#contributions;
    graph.#tokenKinds = this.#tokenKinds;
    graph.#tokenKindOwners = this.#tokenKindOwners;
    graph.#directTokenKinds = this.#directTokenKinds;
    graph.#publicOrder = this.#publicOrder;
    return graph;
  }

  private entry(id: BindingId): BindingEntry | undefined {
    const entry = this.#bindings.get(id);
    if (entry) {
      this.#bindingCache.set(id, entry.description);
      this.#registrationCache.set(id, entry.normalized);
    }
    return entry;
  }

  private slot(key: BindingKey): BindingId | undefined {
    const id = this.#publicSlots.get(key);
    if (id !== undefined) this.#publicCache.set(key, id);
    return id;
  }

  private retainTokenKind(
    key: symbol,
    receivedKind: TokenKind,
    operation: string,
  ): void {
    const expectedKind = this.#tokenKinds.get(key);
    if (expectedKind !== undefined && expectedKind !== receivedKind) {
      throw wrongTokenKind(operation, expectedKind, key);
    }
    this.#tokenKinds = this.#tokenKinds.set(key, receivedKind);
    this.#tokenKindOwners = this.#tokenKindOwners.set(
      key,
      (this.#tokenKindOwners.get(key) ?? 0) + 1,
    );
  }

  private releaseTokenKind(key: symbol): void {
    const owners = this.#tokenKindOwners.get(key);
    if (owners === undefined) return;
    if (owners > 1) {
      this.#tokenKindOwners = this.#tokenKindOwners.set(key, owners - 1);
      return;
    }
    this.#tokenKindOwners = this.#tokenKindOwners.delete(key);
    this.#tokenKinds = this.#tokenKinds.delete(key);
  }

  private claimTokenKind(
    key: symbol,
    receivedKind: TokenKind,
    operation: string,
  ): void {
    this.assertTokenKind(key, receivedKind, operation);
    if (this.#directTokenKinds.has(key)) return;
    this.retainTokenKind(key, receivedKind, operation);
    this.#directTokenKinds = this.#directTokenKinds.set(key, true);
  }

  private retainBindingTokenKinds(entry: BindingEntry, operation: string): void {
    for (const reference of entry.normalized.references) {
      this.retainTokenKind(
        reference.key,
        reference.isCollection ? 'collection' : 'single-service',
        operation,
      );
    }
  }

  private releaseBindingTokenKinds(entry: BindingEntry): void {
    for (const reference of entry.normalized.references) {
      this.releaseTokenKind(reference.key);
    }
  }

  assertTokenKind(
    key: symbol,
    receivedKind: TokenKind,
    operation: string,
  ): void {
    const expectedKind = this.#tokenKinds.get(key);
    if (expectedKind !== undefined && expectedKind !== receivedKind) {
      throw wrongTokenKind(operation, expectedKind, key);
    }
  }

  withTokenKind(
    key: symbol,
    kind: TokenKind,
    operation: string,
  ): BindingGraph {
    this.assertTokenKind(key, kind, operation);
    if (this.#directTokenKinds.has(key)) return this;
    const graph = this.copy();
    graph.claimTokenKind(key, kind, operation);
    return graph;
  }

  private addBinding(
    label: string,
    registration: Registration,
    operation: string,
  ): BindingId {
    const id = Symbol(label);
    const normalized = Object.freeze(normalize(registration));
    const entry: BindingEntry = {
      description: Object.freeze({ id, label, registration, localNames: emptyNames }),
      normalized,
    };
    this.retainBindingTokenKinds(entry, operation);
    this.#bindings = this.#bindings.set(id, entry);
    return id;
  }

  contributionBindings(key: symbol): readonly BindingId[] {
    let ids = this.#contributionCache.get(key);
    if (!ids) {
      const sequence = this.#contributions.get(key);
      if (!sequence) return emptyContributions;
      ids = materialize(sequence);
      this.#contributionCache.set(key, ids);
    }
    return ids;
  }

  withContribution(
    key: symbol,
    registration: Registration,
    operation = 'contribute',
  ): BindingGraph {
    const graph = this.copy();
    graph.claimTokenKind(key, 'collection', operation);
    const id = graph.addBinding(`contribution:${String(key)}`, registration, operation);
    graph.#contributions = graph.#contributions.set(key, append(graph.#contributions.get(key), { values: [id] }));
    graph.#contributed = graph.#contributed.set(id, true);
    return graph;
  }

  hasPublic(key: BindingKey): boolean { return this.#publicCache.has(key) || this.#publicSlots.has(key); }
  hasBinding(id: BindingId): boolean { return this.#bindings.has(id); }

  /**
   * Return the context acquisitions use, resolving the host classifier before any factory runs.
   * Immutable graphs need explicit-mode validation only once; configured independent containers are O(1).
   * A host without a classifier gets every automatic registration named, so the fix is one pass.
   */
  preflight(context: RuntimeContext): RuntimeContext {
    if (context.isNativePromise || this.#explicitlyClassified) return context;
    const automatic: string[] = [];
    for (const [, { description, normalized }] of this.#bindings) {
      if (normalized.acquisitionMode === 'auto' || normalized.operations.some(operation =>
        'acquisitionMode' in operation && operation.acquisitionMode === 'auto')) {
        // The host answers once for the whole graph; only a host without a classifier needs the full list.
        if (!automatic.length) { const resolved = resolveClassifier(context); if (resolved) return resolved; }
        automatic.push(description.label);
      }
    }
    if (automatic.length) throw classifierRequired(automatic);
    this.#explicitlyClassified = true;
    return context;
  }

  publicBinding(key: BindingKey): BindingId {
    return this.#publicCache.get(key) ?? this.requirePublicBinding(key);
  }

  private requirePublicBinding(key: BindingKey): BindingId {
    const id = this.slot(key);
    if (id === undefined) throw libraryError('DI_BAG_MISSING_REGISTRATION', `Service ${JSON.stringify(String(key))} is not registered.`, { operation: 'resolve', key });
    return id;
  }

  findDependency(from: BindingId, localName: BindingKey): BindingId | undefined {
    const ref = (this.#bindingCache.get(from) ?? this.entry(from)?.description)?.localNames.get(localName);
    if (ref?.kind === 'private') return ref.id;
    const key = ref?.key ?? localName;
    return this.#publicCache.get(key) ?? this.slot(key);
  }

  dependency(from: BindingId, localName: BindingKey): BindingId {
    const target = this.findDependency(from, localName);
    if (target === undefined) throw libraryError('DI_BAG_MISSING_DEPENDENCY', `Cannot resolve ${JSON.stringify(this.label(from))}: dependency ${JSON.stringify(String(localName))} is not registered.`, { operation: 'resolve', consumer: this.label(from), dependency: localName, path: Object.freeze([this.label(from), String(localName)]) });
    return target;
  }

  registration(id: BindingId): Normalized {
    return this.#registrationCache.get(id) ?? this.requireRegistration(id);
  }

  private requireRegistration(id: BindingId): Normalized {
    const registration = this.entry(id)?.normalized;
    if (!registration) throw libraryError('DI_BAG_MISSING_REGISTRATION', `Service ${JSON.stringify(this.label(id))} is not registered.`, { bindingId: id });
    return registration;
  }

  label(id: BindingId): string { return (this.#bindingCache.get(id) ?? this.entry(id)?.description)?.label ?? String(id); }

  withPublicRegistrations(
    registrations: Registrations,
    operation = 'register',
  ): BindingGraph {
    return this.withPublicBindings(
      Object.keys(registrations).map(key => [key, registrations[key]!] as const),
      operation,
    );
  }

  /** Replace ordered slots and prune only unreferenced public replacement history. */
  withPublicBindings(
    entries: readonly (readonly [BindingKey, Registration])[],
    operation = 'register',
  ): BindingGraph {
    if (entries.length === 0) return this;
    const graph = this.copy();
    for (const [key, registration] of entries) {
      const previous = graph.#publicSlots.get(key);
      if (previous === undefined) graph.#publicOrder = append(graph.#publicOrder, { values: [key] });
      const id = graph.addBinding(String(key), registration, operation);
      graph.#publicSlots = graph.#publicSlots.set(key, id);
      graph.#publicReferences = graph.#publicReferences.set(id, 1);
      if (previous !== undefined) {
        const remaining = (graph.#publicReferences.get(previous) ?? 1) - 1;
        if (remaining) graph.#publicReferences = graph.#publicReferences.set(previous, remaining);
        else {
          graph.#publicReferences = graph.#publicReferences.delete(previous);
          graph.#obsolete = graph.#obsolete.set(previous, true);
          graph.prune([previous]);
        }
      }
    }
    return graph;
  }

  withPublicBinding(
    key: BindingKey,
    registration: Registration,
    operation = 'register',
  ): BindingGraph {
    return this.withPublicBindings([[key, registration]], operation);
  }

  private releaseLexical(entry: BindingEntry, pending: BindingId[]): void {
    const lexical = entry.lexical;
    if (!lexical) return;
    const remaining = this.#lexicalUsers.get(lexical.id)! - 1;
    if (remaining) { this.#lexicalUsers = this.#lexicalUsers.set(lexical.id, remaining); return; }
    this.#lexicalUsers = this.#lexicalUsers.delete(lexical.id);
    for (const id of lexical.privateIds) {
      const count = this.#privateReferences.get(id)! - 1;
      if (count) this.#privateReferences = this.#privateReferences.set(id, count);
      else { this.#privateReferences = this.#privateReferences.delete(id); pending.push(id); }
    }
  }

  /** No recursion or graph-wide scan, even when losing a snapshot unlocks a chain. */
  private prune(pending: BindingId[]): void {
    while (pending.length) {
      const id = pending.pop()!;
      if (!this.#obsolete.has(id) || this.#publicReferences.has(id) || this.#privateReferences.has(id) || this.#contributed.has(id)) continue;
      const entry = this.#bindings.get(id);
      this.#bindings = this.#bindings.delete(id);
      this.#obsolete = this.#obsolete.delete(id);
      if (entry) {
        this.releaseBindingTokenKinds(entry);
        this.releaseLexical(entry, pending);
      }
    }
  }

  /**
   * Snapshot every retained binding for sealing into a module. Public bindings
   * come first in declaration order, then contributions in their group order,
   * then any privately retained binding. Nothing beyond the graph's own storage
   * is kept to produce this order.
   */
  describe(): GraphDescription {
    const bindings = new Map<BindingId, BindingDescription>();
    const seen = new Set<BindingKey>();
    const take = (id: BindingId) => {
      if (bindings.has(id)) return;
      const entry = this.#bindings.get(id);
      if (entry) bindings.set(id, entry.description);
    };
    if (this.#publicOrder) for (const key of materialize(this.#publicOrder)) {
      if (seen.has(key)) continue;
      seen.add(key);
      const id = this.#publicSlots.get(key);
      if (id !== undefined) take(id);
    }
    const contributions = new Map<symbol, readonly BindingId[]>();
    for (const [key, sequence] of this.#contributions) {
      const ids = materialize(sequence);
      contributions.set(key as symbol, ids);
      for (const id of ids) take(id);
    }
    for (const [id] of this.#bindings) take(id as BindingId);
    const publicSlots = new Map<BindingKey, BindingId>();
    for (const [key, id] of this.#publicSlots) publicSlots.set(key, id);
    const tokenKinds = new Map<symbol, TokenKind>();
    for (const [key, kind] of this.#tokenKinds) {
      tokenKinds.set(key as symbol, kind);
    }
    return { bindings, publicSlots, contributions, tokenKinds };
  }

  /** Every retained binding in `describe()` order, with the public keys that select it. */
  bindingSummaries(): readonly { readonly id: BindingId; readonly keys: readonly BindingKey[] }[] {
    const keysById = new Map<BindingId, BindingKey[]>();
    if (this.#publicOrder) for (const key of materialize(this.#publicOrder)) {
      const id = this.#publicSlots.get(key);
      if (id === undefined) continue;
      const keys = keysById.get(id) ?? [];
      if (!keys.includes(key)) keys.push(key);
      keysById.set(id, keys);
    }
    return Object.freeze([...this.describe().bindings.keys()].map(id => Object.freeze({ id, keys: Object.freeze(keysById.get(id) ?? []) })));
  }

  /** Every contribution group with its member bindings in contribution order. */
  contributionGroups(): readonly { readonly token: symbol; readonly bindingIds: readonly BindingId[] }[] {
    const groups: { readonly token: symbol; readonly bindingIds: readonly BindingId[] }[] = [];
    for (const [key] of this.#contributions) groups.push(Object.freeze({ token: key as symbol, bindingIds: this.contributionBindings(key as symbol) }));
    return Object.freeze(groups);
  }

  /** Install disjoint public slots atomically, retaining lexical private refs. */
  withInstallation(description: GraphDescription): BindingGraph {
    const operation = 'withInstalledModules';
    for (const key of description.publicSlots.keys()) {
      if (this.hasPublic(key)) throw libraryError('DI_BAG_DUPLICATE_REGISTRATION', `duplicate registration: ${String(key)}`, { operation, key });
    }
    const installation = new BindingGraph(description);
    for (const [key, kind] of installation.#tokenKinds) {
      this.assertTokenKind(key as symbol, kind, operation);
    }
    const graph = this.copy();
    const pending: BindingId[] = [];
    // Publish all incoming protection before releasing overwritten descriptions.
    for (const [id, count] of installation.#lexicalUsers) graph.#lexicalUsers = graph.#lexicalUsers.set(id, count);
    for (const [id, count] of installation.#privateReferences) graph.#privateReferences = graph.#privateReferences.set(id, (graph.#privateReferences.get(id) ?? 0) + count);
    for (const [id] of installation.#contributed) graph.#contributed = graph.#contributed.set(id, true);
    for (const [key, id] of installation.#publicSlots) {
      if (typeof key === 'symbol') {
        const kind = installation.#tokenKinds.get(key);
        if (kind !== undefined) graph.claimTokenKind(key, kind, operation);
      }
      graph.#publicOrder = append(graph.#publicOrder, { values: [key] });
      graph.#publicSlots = graph.#publicSlots.set(key, id);
    }
    for (const [id, count] of installation.#publicReferences) graph.#publicReferences = graph.#publicReferences.set(id, (graph.#publicReferences.get(id) ?? 0) + count);
    for (const [id, entry] of installation.#bindings) {
      const previous = graph.#bindings.get(id);
      if (previous) {
        graph.releaseBindingTokenKinds(previous);
        graph.releaseLexical(previous, pending);
      }
      graph.retainBindingTokenKinds(entry, operation);
      graph.#bindings = graph.#bindings.set(id, entry);
      graph.#obsolete = graph.#obsolete.delete(id);
    }
    for (const [key, sequence] of installation.#contributions) {
      graph.claimTokenKind(key as symbol, 'collection', operation);
      graph.#contributions = graph.#contributions.set(key, append(graph.#contributions.get(key), sequence));
    }
    graph.prune(pending);
    return graph;
  }
}

/** Each runtime owns its acquisitions; immutable descriptions remain reusable. */
export class BagRuntime {
  private readonly acquisitions: ScopeAcquisitions;
  private readonly children = new Set<BagRuntime>();
  private closing: Promise<void> | undefined;
  private state: 'open' | 'closing' | 'closed' = 'open';

  /** The configured or host-resolved context; scopes inherit it. */
  readonly context: RuntimeContext;

  constructor(
    private readonly graph: BindingGraph,
    context: RuntimeContext,
    private detach: (() => void) | undefined = undefined,
    private readonly parentAcquisitions?: ScopeAcquisitions,
    shared: readonly BindingId[] = [],
  ) {
    this.context = graph.preflight(context);
    this.acquisitions = new ScopeAcquisitions(graph, this.context, parentAcquisitions, shared);
    this.observeScope('scope-opened');
  }

  resolve(key: BindingKey): unknown {
    return this.acquisitions.resolve(key);
  }

  resolveCollection(key: symbol): unknown {
    return this.acquisitions.resolveCollection(key);
  }

  inspectCollection(
    key: symbol,
  ): readonly RegistrationSnapshot<object, readonly unknown[]>[] {
    const bindingIds = this.graph.hasPublic(key)
      ? [this.graph.publicBinding(key)]
      : this.graph.contributionBindings(key);
    return Object.freeze(
      bindingIds.map(bindingId => this.inspectBinding(bindingId)),
    );
  }

  acquire(key: BindingKey): Promise<void> {
    return this.acquisitions.acquire(key);
  }

  acquireCollection(key: symbol): Promise<void> {
    return this.acquisitions.acquireCollection(key);
  }

  isTransient(key: BindingKey): boolean {
    return this.acquisitions.isTransient(this.graph.publicBinding(key));
  }

  inspect(key: BindingKey): RegistrationSnapshot<object, readonly unknown[]> {
    return this.inspectBinding(this.graph.publicBinding(key));
  }

  inspectGraph(): GraphSnapshot {
    const bindings = this.graph.bindingSummaries().map(({ id, keys }) => {
      const description = this.graph.registration(id);
      return Object.freeze({
        ...this.inspectBinding(id),
        keys,
        lifetime: description.lifetime.kind,
        acquisitionMode: description.acquisitionMode,
        owned: description.dispose !== undefined || description.operations.some(operation => operation.kind === 'owned'),
        tokenDependencies: Object.freeze(description.references.map(reference => Object.freeze({ key: reference.key, kind: reference.kind }))),
      });
    });
    return Object.freeze({
      scopeId: this.acquisitions.ownerId,
      bindings: Object.freeze(bindings),
      contributions: this.graph.contributionGroups(),
      observedEdges: this.acquisitions.observedEdges(),
    });
  }

  private inspectBinding(bindingId: BindingId): RegistrationSnapshot<object, readonly unknown[]> {
    return Object.freeze({
      bindingId,
      label: this.graph.label(bindingId),
      ...this.acquisitions.inspectDescription(bindingId),
      acquisitions: this.acquisitions.inspect(bindingId),
    });
  }

  assertOpen(): void {
    if (this.state !== 'open') throw libraryError(this.state === 'closing' ? 'DI_BAG_CLOSING' : 'DI_BAG_CLOSED', `bag is ${this.state}`, { state: this.state });
    this.acquisitions.assertOpen();
  }

  scope(graph: BindingGraph = this.graph, shared: readonly BindingId[] = []): BagRuntime {
    this.assertOpen();
    let child!: BagRuntime;
    child = new BagRuntime(graph, this.context, () => { this.children.delete(child); }, this.acquisitions, shared);
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
    this.state = 'closing';
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
      () => { this.state = 'closed'; fulfill(); this.observeScope('scope-closed'); },
      error => { this.state = 'closed'; reject(error); this.observeScope('scope-close-failed', error); },
    );

    const detach = this.detach;
    this.detach = undefined;
    if (detach) void closing.then(
      () => { detach(); },
      () => { detach(); },
    );
    return closing;
  }

  /** Labels in progress across this runtime and its live children, for a close deadline report. */
  closeProgress(): { readonly disposersStillRunning: readonly string[]; readonly acquisitionsStillPending: readonly string[] } {
    const pending: string[] = [];
    const acquiring: string[] = [];
    const visit = (runtime: BagRuntime) => {
      for (const child of runtime.children) visit(child);
      runtime.acquisitions.collectProgress(pending, acquiring);
    };
    visit(this);
    return { disposersStillRunning: pending, acquisitionsStillPending: acquiring };
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
      throw diagnostic(new AggregateError(errors, diagnosticMessage('DI_BAG_CLOSE_FAILED', `Failed to close ${errors.length} runtime operation(s)`)), 'DI_BAG_CLOSE_FAILED', { operation: 'close', failedOperations: errors.length });
    }
    if (failures.length > 0) throw new DiBagCleanupError(failures);
  }
}
