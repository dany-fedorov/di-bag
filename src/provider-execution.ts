import { libraryError, libraryTypeError } from './errors';
import type { normalize } from './provider-operations';
import type { AcquisitionMetadataPresence, Presence } from './inspection';
import type { AcquisitionMode, RuntimeContext } from './acquisition-mode';
import type { AcquisitionContext } from './acquisition-context';

type RegistrationDescription = ReturnType<typeof normalize>;
type Disposer = (value: never) => void | Promise<void>;
interface AcceptedStage {
  readonly index: number;
  readonly value: unknown;
  readonly dispose: Disposer;
  state: 'accepted' | 'disposing' | 'disposed';
}
interface ValueStage {
  readonly exposed: unknown;
  state: 'pending' | 'ready' | 'failed';
  value: unknown;
  error: unknown;
  settled?: Promise<void>;
  readonly owners: { index: number; dispose: Disposer }[];
}
interface ExecutionEvents {
  accepted(): void;
  settled(): void;
  invoking(): number;
  cleanupStarted?(): void;
  cleanupCompleted?(outcome: 'success' | 'failure'): void;
  cleanupFailed(sequence: number, error: unknown): void;
}

const observePromise = Promise.prototype.then<void, void>;

/** One source invocation and its ordered projections/ownership, local to an attempt. */
export class ProviderExecution {
  private readonly frames: Presence<unknown>[];
  private readonly stages: AcceptedStage[] = [];
  private readonly pending = new Set<Promise<void>>();
  private result: ValueStage | undefined;
  private cleaning: Promise<void> | undefined;
  // Source permission is independent of the exposed projection's cache state.
  sourceInFlight = true;

  constructor(private readonly events: ExecutionEvents, description: RegistrationDescription, private readonly context: RuntimeContext) {
    // Reserve every metadata frame before the source can reenter inspection.
    this.frames = description.operations.filter(operation => operation.kind === 'frame-sync' || operation.kind === 'frame-async')
      .map(() => Object.freeze({ present: false as const }));
  }

  inspectFrames(): AcquisitionMetadataPresence<readonly unknown[]> { return Object.freeze([...this.frames]); }

  get state(): 'pending' | 'ready' | 'failed' { return this.result?.state ?? 'failed'; }
  get error(): unknown { return this.result?.error; }
  get hasOwnership(): boolean { return this.stages.length > 0; }
  get work(): readonly Promise<void>[] { return [...this.pending]; }

  /** Observe the selected stage, retaining its failure even after retirement. */
  async ready(): Promise<void> {
    const result = this.result;
    if (!result) throw libraryError('DI_BAG_INTERNAL_STATE', 'acquisition has no result', {});
    if (result.state === 'pending') await result.settled;
    if (result.state === 'failed') throw result.error;
  }

  evaluate(description: RegistrationDescription, deps: unknown, acquisitionContext: () => AcquisitionContext): unknown {
    const { create, dispose } = description;
    let current = this.capture(() => description.contextual
      ? Reflect.apply(create, undefined, [deps, acquisitionContext()])
      : create(deps as never), true, description.acquisitionMode);
    let nextFrame = 0;
    if (dispose) this.own(current, 0, dispose);
    description.operations.forEach((operation, offset) => {
      const index = offset + 1;
      if (operation.kind === 'owned') {
        this.own(current, index, operation.dispose);
      } else if (operation.kind === 'map-sync') {
        if (current.state !== 'failed') {
          const input = current.exposed;
          const { project } = operation;
          current = this.capture(() => project(input as never), false, operation.acquisitionMode);
        }
      } else if (operation.kind === 'map-async') {
        const input = current;
        const { project } = operation;
        current = this.capture(async () => {
          if (input.state === 'failed') throw input.error;
          return project(await input.exposed as never);
        }, false, 'nativePromise');
      } else if (operation.kind === 'frame-sync' || operation.kind === 'frame-async') {
        const frameIndex = nextFrame++;
        const input = current;
        const { project } = operation;
        const apply = (value: unknown) => {
          const projected = project(value as never);
          this.frames[frameIndex] = Object.freeze({ present: true, value: projected.frame });
          return projected.value;
        };
        if (operation.kind === 'frame-async') {
          current = this.capture(async () => {
            if (input.state === 'failed') throw input.error;
            return apply(await input.exposed);
          }, false, 'nativePromise');
        } else if (input.state !== 'failed') {
          current = this.capture(() => apply(input.exposed), false, operation.acquisitionMode);
        }
      }
    });
    this.result = current;
    if (current.state === 'failed') throw current.error;
    return current.exposed;
  }

  private capture(create: () => unknown, source: boolean, mode: AcquisitionMode): ValueStage {
    try {
      const exposed = create();
      const stage: ValueStage = { exposed, state: 'ready', value: exposed, error: undefined, owners: [] };
      let native = mode === 'nativePromise';
      if (mode === 'auto') {
        const { isNativePromise } = this.context;
        // Whole-graph preflight establishes capability before invoking this factory.
        const classified = isNativePromise!(exposed);
        if (typeof classified !== 'boolean') throw libraryError('DI_BAG_INVALID_CLASSIFIER_RESULT', 'isNativePromise must return a boolean', { option: 'isNativePromise', provided: classified });
        native = classified;
      }
      if (mode !== 'raw' && exposed !== null && (typeof exposed === 'object' || typeof exposed === 'function') && 'then' in exposed) {
        // Preserve original getter failures, but never use callability as native branding.
        const then = Reflect.get(exposed, 'then');
        if (!native && typeof then === 'function') throw libraryTypeError('DI_BAG_STRUCTURAL_THENABLE', 'Structural thenables require explicit native Promise conversion or raw acquisitionMode', { acquisitionMode: mode });
      }
      if (native) {
        let settled!: () => void;
        const barrier = new Promise<void>(resolve => { settled = resolve; });
        // The species result is untrusted; only our independently made barrier
        // participates in draining. No structural assimilation or error fallback.
        observePromise.call(exposed, value => {
          stage.state = 'ready';
          stage.value = value;
          for (const owner of stage.owners) this.accept(owner.index, value, owner.dispose);
          finish();
        }, error => {
          stage.state = 'failed';
          stage.error = error;
          finish();
        });
        stage.state = 'pending';
        stage.value = undefined;
        stage.settled = barrier;
        this.pending.add(barrier);
        const finish = () => {
          if (source) this.sourceInFlight = false;
          this.pending.delete(barrier);
          settled();
          if (this.result === stage) this.events.settled();
        };
      } else if (source) {
        this.sourceInFlight = false;
      }
      return stage;
    } catch (error) {
      if (source) this.sourceInFlight = false;
      return { exposed: undefined, state: 'failed', value: undefined, error, owners: [] };
    }
  }

  private own(stage: ValueStage, index: number, dispose: Disposer): void {
    if (stage.state === 'ready') this.accept(index, stage.value, dispose);
    else if (stage.state === 'pending') stage.owners.push({ index, dispose });
  }

  private accept(index: number, value: unknown, dispose: Disposer): void {
    this.stages.push({ index, value, dispose, state: 'accepted' });
    this.events.accepted();
  }

  dispose(): Promise<void> {
    if (this.cleaning) return this.cleaning;
    let complete!: () => void;
    this.cleaning = new Promise<void>(resolve => { complete = resolve; });
    // Publish before invoking user code, including synchronous finalizers.
    void this.disposeStages().then(complete);
    return this.cleaning;
  }

  private async disposeStages(): Promise<void> {
    // All later acceptances must be known before reversing stable stage indices.
    while (this.pending.size) await Promise.all(this.pending);
    const owned = this.stages.length > 0;
    let failed = false;
    if (owned) this.events.cleanupStarted?.();
    for (const stage of this.stages.sort((a, b) => b.index - a.index)) {
      stage.state = 'disposing';
      const sequence = this.events.invoking();
      const { dispose, value } = stage;
      try {
        await dispose(value as never);
      } catch (error) {
        failed = true;
        this.events.cleanupFailed(sequence, error);
      } finally {
        stage.state = 'disposed';
      }
    }
    if (owned) this.events.cleanupCompleted?.(failed ? 'failure' : 'success');
    this.stages.length = 0;
    this.result = undefined;
  }

  release(): void {
    this.frames.length = 0;
    this.stages.length = 0;
    this.pending.clear();
    this.result = undefined;
  }
}
