import type { BindingGraph, BindingId, BindingKey } from './runtime';
import type { InspectionSnapshot, AcquisitionSnapshot } from './inspection';
import type { RuntimeContext } from './acquisition-mode';
/** Mutable, runtime-local attempts. Binding descriptions never carry ownership. */
export declare class Acquisitions {
    private readonly graph;
    private readonly context;
    private readonly parent?;
    readonly ownerId: symbol;
    private readonly cache;
    private readonly attempts;
    private readonly retired;
    private readonly failures;
    private invocationSequence;
    private readonly owned;
    private state;
    private closing;
    private controller;
    private acquisitionContext;
    private cancellationStarted;
    private cancellationCause;
    private readonly shared;
    private readonly family;
    constructor(graph: BindingGraph, context: RuntimeContext, parent?: Acquisitions | undefined, shared?: readonly BindingId[]);
    private owner;
    resolve(key: BindingKey): unknown;
    resolveAll(key: symbol): readonly unknown[];
    private resolveCollection;
    acquire(key: BindingKey): Promise<void>;
    private takeExposed;
    inspect(bindingId: BindingId, path?: readonly BindingId[]): readonly AcquisitionSnapshot<readonly unknown[]>[];
    isTransient(bindingId: BindingId, path?: readonly BindingId[]): boolean;
    /** Relationship uses the effective owner graph; frames use canonical attempts. */
    inspectDescription(bindingId: BindingId): Pick<InspectionSnapshot<object, readonly unknown[]>, 'metadata' | 'alias'>;
    private assertAliasPath;
    assertOpen(): void;
    close(beforeDispose?: Promise<void>, cause?: unknown): Promise<void>;
    private getContext;
    private resolveBinding;
    private eventFields;
    private observeAttempt;
    private retire;
    private disposeAll;
}
