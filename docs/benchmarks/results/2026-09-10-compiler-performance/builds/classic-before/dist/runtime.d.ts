import { Acquisitions } from './acquisition';
import { normalize } from './registration';
import type { Registration, Registrations } from './registration';
import type { InspectionSnapshot } from './inspection';
import type { RuntimeContext } from './acquisition-mode';
export type BindingId = symbol;
export type BindingKey = string | symbol;
export type BindingRef = {
    readonly kind: 'private';
    readonly id: BindingId;
} | {
    readonly kind: 'public';
    readonly key: BindingKey;
};
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
/** Immutable descriptions and path-copied lookup storage. Retained maps never escape. */
export declare class BindingGraph {
    #private;
    constructor(description?: GraphDescription);
    /** Share only storage roots. Caches never retain ancestor wrappers or old arrays. */
    private copy;
    private entry;
    private slot;
    private addBinding;
    contributionBindings(key: symbol): readonly BindingId[];
    withContribution(key: symbol, registration: Registration): BindingGraph;
    hasPublic(key: BindingKey): boolean;
    hasBinding(id: BindingId): boolean;
    /** Immutable graphs need explicit-mode validation only once; configured forks are O(1). */
    preflight(context: RuntimeContext): void;
    publicBinding(key: BindingKey): BindingId;
    private requirePublicBinding;
    findDependency(from: BindingId, localName: BindingKey): BindingId | undefined;
    dependency(from: BindingId, localName: BindingKey): BindingId;
    registration(id: BindingId): Normalized;
    private requireRegistration;
    label(id: BindingId): string;
    withPublicRegistrations(registrations: Registrations): BindingGraph;
    /** Replace ordered slots and prune only unreferenced public replacement history. */
    withPublicBindings(entries: readonly (readonly [BindingKey, Registration])[]): BindingGraph;
    withPublicBinding(key: BindingKey, registration: Registration): BindingGraph;
    private releaseLexical;
    /** No recursion or graph-wide scan, even when losing a snapshot unlocks a chain. */
    private prune;
    /** Install disjoint public slots atomically, retaining lexical private refs. */
    withInstallation(description: GraphDescription): BindingGraph;
}
/** Each runtime owns its acquisitions; immutable descriptions remain reusable. */
export declare class Runtime {
    private readonly graph;
    private readonly context;
    private detach;
    private readonly parentAcquisitions?;
    private readonly acquisitions;
    private readonly children;
    private closing;
    constructor(graph: BindingGraph, context: RuntimeContext, detach?: (() => void) | undefined, parentAcquisitions?: Acquisitions | undefined, shared?: readonly BindingId[]);
    resolve(key: BindingKey): unknown;
    resolveAll(key: symbol): readonly unknown[];
    inspectAll(key: symbol): readonly InspectionSnapshot<object, readonly unknown[]>[];
    acquire(key: BindingKey): Promise<void>;
    isTransient(key: BindingKey): boolean;
    inspect(key: BindingKey): InspectionSnapshot<object, readonly unknown[]>;
    private inspectBinding;
    assertOpen(): void;
    scope(graph?: BindingGraph, shared?: readonly BindingId[]): Runtime;
    close(cause?: unknown): Promise<void>;
    private observeScope;
    private finishClose;
}
export {};
