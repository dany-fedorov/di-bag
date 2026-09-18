import { libraryError, libraryTypeError } from './errors';
import type { normalize } from './provider-operations';
import type { AcquisitionMetadataPresence, Presence } from './inspection';
import type { AcquisitionMode, RuntimeContext } from './acquisition-mode';
import type { AcquisitionContext, DisposerContext } from './acquisition-context';

type RegistrationDescription = ReturnType<typeof normalize>;
type Disposer = (value: never) => void | Promise<void>;
type PushedDisposer = (this: void, disposerCtx: DisposerContext) => void | Promise<void>;

/**
 * One factory's pushed disposers. It is held by the frozen acquisition context
 * handed to that factory, so it deliberately references neither the execution
 * nor its scope: a context the application retains must keep nothing but its
 * own registrations alive.
 */
export class DisposerStack {
  private readonly disposers: PushedDisposer[] = [];
  private settled = false;

  /** Own a resource the running factory already holds. */
  push(disposer: PushedDisposer): void {
    if (typeof disposer !== 'function') throw libraryError('DI_BAG_INVALID_CLEANUP', 'pushDisposer requires a function', { operation: 'pushDisposer', provided: typeof disposer });
    // A retained context is a leak, not a stack: registration closes with the factory.
    if (this.settled) throw libraryError('DI_BAG_CLEANUP_AFTER_FACTORY', 'pushDisposer is only available while its factory is running', { operation: 'pushDisposer' });
    this.disposers.push(disposer);
  }

  /** The factory settled; nothing more can be pushed. */
  settle(): void { this.settled = true; }

  get pending(): boolean { return this.disposers.length > 0; }

  /** Take every pushed disposer, last pushed first, and close registration for good. */
  drain(): readonly PushedDisposer[] {
    this.settled = true;
    return this.disposers.splice(0).reverse();
  }
}

interface AcceptedStage {
  readonly index: number;
  readonly value: unknown;
  readonly dispose: Disposer;
  /** Owns the value the factory returned, rather than a transformed value. */
  readonly returned: boolean;
  state: 'accepted' | 'disposing' | 'disposed';
}
interface ValueStage {
  exposed: unknown;
  consumed: boolean;
  state: 'pending' | 'ready' | 'failed';
  value: unknown;
  error: unknown;
  settled?: Promise<void>;
  readonly owners: { index: number; dispose: Disposer; returned: boolean }[];
}
interface ExecutionEvents {
  accepted(): void;
  settled(): void;
  drained(): void;
  invoking(): number;
  cleanupStarted?(): void;
  cleanupCompleted?(outcome: 'success' | 'failure'): void;
  cleanupFailed(sequence: number, error: unknown): void;
}

const observePromise = Promise.prototype.then<void, void>;

const emptyFrames: AcquisitionMetadataPresence<readonly unknown[]> = Object.freeze([]);
const emptyWork: readonly Promise<void>[] = Object.freeze([]);

/** Fully drained borrowed attempts keep frames, but no execution closures or payloads. */
export class CompletedExecution {
  readonly state = 'ready';
  readonly sourceInFlight = false;
  readonly hasOwnership = false;
  readonly rollingBack = false;
  readonly disposers = undefined;
  readonly error = undefined;
  readonly work = emptyWork;
  constructor(private frames: AcquisitionMetadataPresence<readonly unknown[]>) {}
  inspectFrames(): AcquisitionMetadataPresence<readonly unknown[]> { return Object.freeze([...this.frames]); }
  async ready(): Promise<void> {}
  async dispose(): Promise<void> {}
  release(): void {
    // Frame-bearing records belong to one attempt; the shared empty record is
    // never mutated. Inspection arrays already returned to callers stay intact.
    if (this.frames.length) this.frames = emptyFrames;
  }
}
const completedWithoutFrames = new CompletedExecution(emptyFrames);

/** One source invocation and its ordered projections/ownership, local to an attempt. */
export class ProviderExecution {
  private readonly frames: Presence<unknown>[];
  private readonly stages: AcceptedStage[] = [];
  /** Allocated only for a context-aware factory, which is the only source that can push disposers. */
  readonly disposers: DisposerStack | undefined;
  // The factory returned, so the bag owns what it pushed, below every accepted stage.
  private disposersOwned = false;
  // The failure-path run of the stack, while it is in flight.
  private rollback: Promise<void> | undefined;
  private readonly pending = new Set<Promise<void>>();
  private result: ValueStage | undefined;
  private cleaning: Promise<void> | undefined;
  // Source permission is independent of the exposed projection's cache state.
  sourceInFlight = true;

  constructor(private readonly events: ExecutionEvents, description: RegistrationDescription, private readonly context: RuntimeContext) {
    // Reserve every metadata frame before the source can reenter inspection.
    this.frames = description.operations.filter(operation => operation.kind === 'frame-sync' || operation.kind === 'frame-async')
      .map(() => Object.freeze({ present: false as const }));
    if (description.contextual) this.disposers = new DisposerStack();
  }

  inspectFrames(): AcquisitionMetadataPresence<readonly unknown[]> { return Object.freeze([...this.frames]); }

  get state(): 'pending' | 'ready' | 'failed' { return this.result?.state ?? 'failed'; }
  get error(): unknown { return this.result?.error; }
  get hasOwnership(): boolean { return this.stages.length > 0 || this.disposersOwned; }
  get rollingBack(): boolean { return this.rollback !== undefined; }
  get work(): readonly Promise<void>[] { return [...this.pending]; }

  /**
   * The source stage settles the stack. A factory that returned hands what it
   * pushed to the bag; a failed one releases it at once, as pending work of this
   * execution. Anchoring on the source rather than on the attempt's result covers
   * a direct projection that is already ready while its source is still running,
   * which no retirement reaches.
   */
  private settleDisposers(state: 'ready' | 'failed'): void {
    if (!this.disposers) return;
    this.disposers.settle();
    if (!this.disposers.pending) return;
    if (state === 'ready') {
      this.disposersOwned = true;
      this.events.accepted();
      return;
    }
    const work: Promise<void> = this.rollbackDisposers().then(() => {
      this.rollback = undefined;
      this.pending.delete(work);
      if (!this.pending.size) this.events.drained();
    });
    this.rollback = work;
    this.pending.add(work);
  }

  private async rollbackDisposers(): Promise<void> {
    // One microtask after the source settles: a synchronous failure never runs
    // cleanup inline, and an unprojected attempt has already reported
    // acquisition-failed. Under a projection the result settles later, so this
    // run can precede both acquisition-failed and the consumer's rejection.
    await undefined;
    this.events.cleanupStarted?.();
    const failed = await this.runDisposers('factory-failed');
    this.events.cleanupCompleted?.(failed ? 'failure' : 'success');
  }

  /** Run every pushed disposer, last pushed first, all attempted; true when one threw. */
  private async runDisposers(reason: DisposerContext['reason']): Promise<boolean> {
    const disposerCtx: DisposerContext = Object.freeze({ reason });
    let failed = false;
    for (const disposer of this.disposers?.drain() ?? []) {
      const sequence = this.events.invoking();
      try {
        await disposer(disposerCtx);
      } catch (error) {
        failed = true;
        this.events.cleanupFailed(sequence, error);
      }
    }
    return failed;
  }

  /** Observe the selected stage, retaining its failure even after retirement. */
  async ready(): Promise<void> {
    const result = this.result;
    if (!result) throw libraryError('DI_BAG_INTERNAL_STATE', 'acquisition has no result', {});
    if (result.state === 'pending') await result.settled;
    if (result.state === 'failed') throw result.error;
  }

  compact(): ProviderExecution | CompletedExecution {
    if (this.state !== 'ready' || this.pending.size || this.hasOwnership) return this;
    if (!this.frames.length) return completedWithoutFrames;
    // The copy owns the frames from here; a retained reference to this record
    // must not keep the application's frame payloads alive.
    const completed = new CompletedExecution(this.inspectFrames());
    this.frames.length = 0;
    return completed;
  }

  /** Classify/own only after the direct operation-free source call has returned. */
  publishSource(value: unknown, description: RegistrationDescription): void {
    if (description.acquisitionMode === 'raw') {
      this.sourceInFlight = false;
      this.result = { exposed: undefined, consumed: true, state: 'ready', value: undefined, error: undefined, owners: [] };
      if (description.dispose) this.accept(0, value, description.dispose, true);
      return;
    }
    const stage = this.capture(() => value, true, description.acquisitionMode);
    if (description.dispose) this.own(stage, 0, description.dispose, true);
    this.result = stage;
    this.consume(stage);
    if (stage.state === 'failed') throw stage.error;
  }

  evaluate(description: RegistrationDescription, deps: unknown, context: AcquisitionContext | undefined): unknown {
    const { create, dispose } = description;
    let current = this.capture(() => description.contextual
      ? Reflect.apply(create, undefined, [deps, context])
      : create(deps as never), true, description.acquisitionMode);
    // A pending source settles its own rollback list from the promise handler.
    if (current.state !== 'pending') this.settleDisposers(current.state);
    let nextFrame = 0;
    // Ownership attached before the first transform owns the value the factory
    // returned; metadata frames preserve the value, so they do not end it.
    let returned = true;
    if (dispose) this.own(current, 0, dispose, true);
    description.operations.forEach((operation, offset) => {
      const inputStage = current;
      const index = offset + 1;
      if (operation.kind === 'owned') {
        this.own(current, index, operation.dispose, returned);
      } else if (operation.kind === 'map-sync') {
        returned = false;
        if (current.state !== 'failed') {
          const input = current.exposed;
          const { project } = operation;
          current = this.capture(() => project(input as never), false, operation.acquisitionMode);
        }
      } else if (operation.kind === 'map-async') {
        returned = false;
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
      if (current !== inputStage) this.consume(inputStage);
    });
    this.result = current;
    if (current.state === 'failed') throw current.error;
    const exposed = current.exposed;
    this.consume(current);
    return exposed;
  }

  private consume(stage: ValueStage): void {
    // Projections have captured their input and ownership has its own value.
    // Pending callbacks still accept ownership, but must not retain fulfillment.
    stage.consumed = true;
    stage.exposed = undefined;
    stage.value = undefined;
  }

  private capture(create: () => unknown, source: boolean, mode: AcquisitionMode): ValueStage {
    try {
      const exposed = create();
      const stage: ValueStage = { exposed, consumed: false, state: 'ready', value: exposed, error: undefined, owners: [] };
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
          if (!stage.consumed) stage.value = value;
          for (const owner of stage.owners) this.accept(owner.index, value, owner.dispose, owner.returned);
          stage.owners.length = 0;
          finish();
        }, error => {
          stage.state = 'failed';
          stage.error = error;
          stage.owners.length = 0;
          finish();
        });
        stage.state = 'pending';
        stage.value = undefined;
        stage.settled = barrier;
        this.pending.add(barrier);
        const finish = () => {
          if (source) {
            this.sourceInFlight = false;
            this.settleDisposers(stage.state === 'ready' ? 'ready' : 'failed');
          }
          this.pending.delete(barrier);
          settled();
          if (this.result === stage) this.events.settled();
          if (!this.pending.size) this.events.drained();
        };
      } else if (source) {
        this.sourceInFlight = false;
      }
      return stage;
    } catch (error) {
      if (source) this.sourceInFlight = false;
      return { exposed: undefined, consumed: true, state: 'failed', value: undefined, error, owners: [] };
    }
  }

  private own(stage: ValueStage, index: number, dispose: Disposer, returned: boolean): void {
    if (stage.state === 'ready') this.accept(index, stage.value, dispose, returned);
    else if (stage.state === 'pending') stage.owners.push({ index, dispose, returned });
  }

  private accept(index: number, value: unknown, dispose: Disposer, returned: boolean): void {
    this.stages.push({ index, value, dispose, returned, state: 'accepted' });
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
    const owned = this.hasOwnership;
    let failed = false;
    let returnedOwned = false;
    let returnedFailed = false;
    if (owned) this.events.cleanupStarted?.();
    for (const stage of this.stages.sort((a, b) => b.index - a.index)) {
      stage.state = 'disposing';
      if (stage.returned) returnedOwned = true;
      const sequence = this.events.invoking();
      const { dispose, value } = stage;
      try {
        await dispose(value as never);
      } catch (error) {
        failed = true;
        if (stage.returned) returnedFailed = true;
        this.events.cleanupFailed(sequence, error);
      } finally {
        stage.state = 'disposed';
      }
    }
    // Pushed disposers are the bottom of the ownership stack: they run after every
    // accepted stage and are told how the returned value's own disposer went. A
    // projection owner belongs to whoever transformed the value; its outcome is
    // reported through cleanup-failed, not through the reason.
    if (this.disposersOwned) {
      const reason = !returnedOwned ? 'no-service-disposer' : returnedFailed ? 'service-disposal-failed' : 'service-disposed';
      if (await this.runDisposers(reason)) failed = true;
      this.disposersOwned = false;
    }
    if (owned) this.events.cleanupCompleted?.(failed ? 'failure' : 'success');
    this.stages.length = 0;
    this.result = undefined;
  }

  // Reached only after every barrier and rollback has drained; draining the stack
  // here is for a context the application retained, never for a running one.
  release(): void {
    this.frames.length = 0;
    this.stages.length = 0;
    this.disposers?.drain();
    this.disposersOwned = false;
    this.pending.clear();
    this.result = undefined;
  }
}
