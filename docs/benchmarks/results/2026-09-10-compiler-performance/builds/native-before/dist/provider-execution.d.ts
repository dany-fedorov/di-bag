import type { normalize } from './provider-operations';
import type { FramePresenceTuple } from './inspection';
import type { RuntimeContext } from './acquisition-mode';
import type { AcquisitionContext } from './acquisition-context';
type RegistrationDescription = ReturnType<typeof normalize>;
interface ExecutionEvents {
    accepted(): void;
    settled(): void;
    drained(): void;
    invoking(): number;
    cleanupStarted?(): void;
    cleanupCompleted?(outcome: 'success' | 'failure'): void;
    cleanupFailed(sequence: number, error: unknown): void;
}
/** Fully drained borrowed attempts keep frames, but no execution closures or payloads. */
export declare class CompletedExecution {
    private frames;
    readonly state = "ready";
    readonly sourceInFlight = false;
    readonly hasOwnership = false;
    readonly error: undefined;
    readonly work: readonly Promise<void>[];
    constructor(frames: FramePresenceTuple<readonly unknown[]>);
    inspectFrames(): FramePresenceTuple<readonly unknown[]>;
    ready(): Promise<void>;
    dispose(): Promise<void>;
    release(): void;
}
/** One source invocation and its ordered projections/ownership, local to an attempt. */
export declare class ProviderExecution {
    private readonly events;
    private readonly context;
    private readonly frames;
    private readonly stages;
    private readonly pending;
    private result;
    private cleaning;
    sourceInFlight: boolean;
    constructor(events: ExecutionEvents, description: RegistrationDescription, context: RuntimeContext);
    inspectFrames(): FramePresenceTuple<readonly unknown[]>;
    get state(): 'pending' | 'ready' | 'failed';
    get error(): unknown;
    get hasOwnership(): boolean;
    get work(): readonly Promise<void>[];
    /** Observe the selected stage, retaining its failure even after retirement. */
    ready(): Promise<void>;
    compact(): ProviderExecution | CompletedExecution;
    /** Classify/own only after the direct operation-free source call has returned. */
    publishSource(value: unknown, description: RegistrationDescription): void;
    evaluate(description: RegistrationDescription, deps: unknown, acquisitionContext: () => AcquisitionContext): unknown;
    private consume;
    private capture;
    private own;
    private accept;
    dispose(): Promise<void>;
    private disposeStages;
    release(): void;
}
export {};
