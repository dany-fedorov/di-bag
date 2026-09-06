import { Acquisitions } from './acquisition';
import { normalize } from './registration';
import type { Registration, Registrations } from './registration';
import type { InspectionSnapshot } from './inspection';

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

  /** Replace one public slot, preserving lexical references and symbol identity. */
  withPublicBinding(key: BindingKey, registration: Registration): BindingGraph {
    const bindings = new Map(this.#bindings);
    const publicSlots = new Map(this.#publicSlots);
    const id = Symbol(String(key));
    bindings.set(id, { id, label: String(key), registration, localNames: new Map() });
    publicSlots.set(key, id);
    return new BindingGraph({ bindings, publicSlots });
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

  constructor(private readonly graph: BindingGraph) {
    this.acquisitions = new Acquisitions(graph);
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
    this.acquisitions.assertOpen();
  }

  close(): Promise<void> {
    return this.acquisitions.close();
  }
}
