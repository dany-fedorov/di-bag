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
}

type Normalized = Readonly<ReturnType<typeof normalize>>;

/** Immutable descriptions: input maps are copied and retained maps never escape. */
export class BindingGraph {
  readonly #bindings = new Map<BindingId, BindingDescription>();
  readonly #registrations = new Map<BindingId, Normalized>();
  readonly #publicSlots: Map<BindingKey, BindingId>;
  #explicitlyClassified = false;

  constructor(description: GraphDescription = { bindings: new Map(), publicSlots: new Map() }) {
    for (const [id, binding] of description.bindings) {
      this.#bindings.set(id, Object.freeze({
        id: binding.id,
        label: binding.label,
        registration: binding.registration,
        localNames: new Map([...binding.localNames].map(([name, ref]) => [name, Object.freeze({ ...ref })])),
      }));
      this.#registrations.set(id, Object.freeze(normalize(binding.registration)));
    }
    this.#publicSlots = new Map(description.publicSlots);
  }

  hasPublic(key: BindingKey): boolean {
    return this.#publicSlots.has(key);
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
    const bindings = new Map(this.#bindings);
    const publicSlots = new Map(this.#publicSlots);
    for (const [key, registration] of entries) {
      const id = Symbol(String(key));
      bindings.set(id, {
        id,
        label: String(key),
        registration,
        localNames: new Map(),
      });
      publicSlots.set(key, id);
    }
    return new BindingGraph({ bindings, publicSlots });
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
    return new BindingGraph({
      bindings: new Map([...this.#bindings, ...description.bindings]),
      publicSlots: new Map([...this.#publicSlots, ...description.publicSlots]),
    });
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
  ) {
    graph.preflight(context);
    this.acquisitions = new Acquisitions(graph, context);
  }

  resolve(key: BindingKey): unknown {
    return this.acquisitions.resolve(key);
  }

  inspect(key: BindingKey): InspectionSnapshot<object, readonly unknown[]> {
    const bindingId = this.graph.publicBinding(key);
    return Object.freeze({
      bindingId,
      label: this.graph.label(bindingId),
      metadata: this.graph.registration(bindingId).metadata,
      acquisitions: this.acquisitions.inspect(bindingId),
    });
  }

  assertOpen(): void {
    if (this.closing) throw new Error('bag is closing');
    this.acquisitions.assertOpen();
  }

  scope(): Runtime {
    this.assertOpen();
    let child!: Runtime;
    child = new Runtime(this.graph, this.context, () => { this.children.delete(child); });
    this.children.add(child);
    return child;
  }

  close(): Promise<void> {
    if (this.closing) return this.closing;
    let fulfill!: () => void;
    let reject!: (error: unknown) => void;
    const closing = new Promise<void>((resolve, fail) => { fulfill = resolve; reject = fail; });
    // Publish before recursively closing children or starting local cleanup.
    this.closing = closing;

    const childClosing = [...this.children].map(child => {
      try { return child.close(); }
      catch (error) { return Promise.reject(error); }
    });
    const childResults = Promise.allSettled(childClosing);
    let localClosing: Promise<void>;
    try {
      localClosing = this.acquisitions.close(
        childClosing.length > 0 ? childResults.then(() => undefined) : undefined,
      );
    }
    catch (error) { localClosing = Promise.reject(error); }
    void this.finishClose(childResults, localClosing).then(fulfill, reject);

    const detach = this.detach;
    this.detach = undefined;
    if (detach) void closing.then(
      () => { detach(); },
      () => { detach(); },
    );
    return closing;
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
