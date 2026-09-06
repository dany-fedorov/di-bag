import { normalize } from './registration';
import type { Registration, Registrations } from './registration';

export type BindingId = symbol;
export type BindingRef =
  | { readonly kind: 'private'; readonly id: BindingId }
  | { readonly kind: 'public'; readonly key: string };

export interface BindingDescription {
  readonly id: BindingId;
  readonly label: string;
  readonly registration: Registration;
  readonly localNames: ReadonlyMap<string, BindingRef>;
}

export interface GraphDescription {
  readonly bindings: ReadonlyMap<BindingId, BindingDescription>;
  readonly publicSlots: ReadonlyMap<string, BindingId>;
}

type Normalized = Readonly<ReturnType<typeof normalize>>;

/** Immutable descriptions: input maps are copied and retained maps never escape. */
export class BindingGraph {
  readonly #bindings = new Map<BindingId, BindingDescription>();
  readonly #registrations = new Map<BindingId, Normalized>();
  readonly #publicSlots: Map<string, BindingId>;

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

  hasPublic(key: string): boolean {
    return this.#publicSlots.has(key);
  }

  publicBinding(key: string): BindingId {
    const id = this.#publicSlots.get(key);
    if (id === undefined) throw new Error(`no factory for ${key}`);
    return id;
  }

  dependency(from: BindingId, localName: string): BindingId {
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
    const bindings = new Map(this.#bindings);
    const publicSlots = new Map(this.#publicSlots);
    for (const key of Object.keys(registrations)) {
      const id = Symbol(key);
      bindings.set(id, {
        id,
        label: key,
        registration: registrations[key]!,
        localNames: new Map(),
      });
      publicSlots.set(key, id);
    }
    return new BindingGraph({ bindings, publicSlots });
  }

  /** Install disjoint public slots atomically, retaining lexical private refs. */
  withInstallation(description: GraphDescription): BindingGraph {
    for (const key of description.publicSlots.keys()) {
      if (this.#publicSlots.has(key)) throw new Error(`duplicate registration: ${key}`);
    }
    return new BindingGraph({
      bindings: new Map([...this.#bindings, ...description.bindings]),
      publicSlots: new Map([...this.#publicSlots, ...description.publicSlots]),
    });
  }
}

type Cleanup = () => void | Promise<void>;
const observePromise = Promise.prototype.then<void, void>;

function isThenable(value: unknown): value is PromiseLike<unknown> {
  return (
    value !== null &&
    (typeof value === 'object' || typeof value === 'function') &&
    'then' in value &&
    typeof value.then === 'function'
  );
}

/** Each runtime owns its memoized acquisitions and cleanup state. */
export class Runtime {
  private readonly memo = new Map<BindingId, unknown>();
  private readonly edges = new Map<BindingId, Set<BindingId>>();
  private readonly pending = new Map<BindingId, Promise<void>>();
  private readonly creating = new Set<BindingId>();
  private readonly cleanups = new Map<BindingId, Cleanup>();
  private state: 'open' | 'closing' | 'closed' = 'open';
  private closing: Promise<void> | undefined;

  constructor(private readonly graph: BindingGraph) {}

  resolve(key: string): unknown {
    this.assertOpen();
    return this.resolveBinding(this.graph.publicBinding(key));
  }

  assertOpen(): void {
    if (this.state !== 'open') throw new Error(`bag is ${this.state}`);
  }

  /** Drain acquisitions, then dispose dependents before dependencies, once. */
  close(): Promise<void> {
    if (this.closing) return this.closing;
    this.state = 'closing';
    // Defer cleanup until this.closing is set, including for reentrant close calls.
    this.closing = Promise.resolve().then(() => this.disposeAll());
    return this.closing;
  }

  private resolveBinding(id: BindingId): unknown {
    if (this.memo.has(id)) return this.memo.get(id);
    const { create, dispose } = this.graph.registration(id);
    this.edges.set(id, new Set());
    const deps = new Proxy(Object.create(null) as Record<string, unknown>, {
      get: (_, key) => {
        if (typeof key !== 'string') return undefined;
        // In-flight factories can continue discovering dependencies during close.
        if (
          this.state === 'closed' ||
          (this.state === 'closing' && !this.pending.has(id) && !this.creating.has(id))
        ) {
          throw new Error(`bag is ${this.state}`);
        }
        const target = this.graph.dependency(id, key);
        this.recordEdge(id, target);
        return this.resolveBinding(target);
      },
    });

    // The checked facade validates factory parameter shapes before graph creation.
    let value: unknown;
    this.creating.add(id);
    try {
      value = create(deps as never);
    } catch (error) {
      this.edges.delete(id);
      throw error;
    } finally {
      this.creating.delete(id);
    }
    this.memo.set(id, value);
    const acquired = (fulfilled: unknown) => {
      if (dispose) this.cleanups.set(id, () => dispose(fulfilled as never));
    };
    try {
      if (isThenable(value)) {
        // Preserve the original result. Native reactions bypass an own then override.
        const observed = observePromise.call(
          Promise.resolve(value),
          (fulfilled) => {
            acquired(fulfilled);
            this.pending.delete(id);
          },
          () => {
            this.memo.delete(id);
            this.edges.delete(id);
            this.pending.delete(id);
          },
        );
        this.pending.set(id, observed);
      } else {
        acquired(value);
      }
    } catch (error) {
      // Failed inspection or observer setup has not transferred ownership.
      this.memo.delete(id);
      this.edges.delete(id);
      this.pending.delete(id);
      throw error;
    }
    return value;
  }

  private recordEdge(from: BindingId, to: BindingId): void {
    const path = this.path(to, from, new Set());
    if (path) throw new Error(`cycle: ${[...path, to].map(id => this.graph.label(id)).join(' -> ')}`);
    this.edges.get(from)?.add(to);
  }

  private path(from: BindingId, to: BindingId, seen: Set<BindingId>): BindingId[] | undefined {
    if (from === to) return [from];
    if (seen.has(from)) return undefined;
    seen.add(from);
    for (const dependency of this.edges.get(from) ?? []) {
      const rest = this.path(dependency, to, seen);
      if (rest) return [from, ...rest];
    }
    return undefined;
  }

  private async disposeAll(): Promise<void> {
    let failed = false;
    let firstError: unknown;
    try {
      // Pending factories can start further dependencies, so drain to a fixed point.
      while (this.pending.size > 0) await Promise.all(this.pending.values());
      const ordered: Cleanup[] = [];
      const visited = new Set<BindingId>();
      const visit = (id: BindingId) => {
        if (visited.has(id)) return;
        visited.add(id);
        for (const dependency of this.edges.get(id) ?? []) visit(dependency);
        const cleanup = this.cleanups.get(id);
        if (cleanup) ordered.push(cleanup);
      };
      for (const id of this.cleanups.keys()) visit(id);
      for (const cleanup of ordered.reverse()) {
        try {
          await cleanup();
        } catch (error) {
          if (!failed) {
            failed = true;
            firstError = error;
          }
        }
      }
    } finally {
      this.state = 'closed';
      this.memo.clear();
      this.edges.clear();
      this.cleanups.clear();
    }
    if (failed) throw firstError;
  }
}
