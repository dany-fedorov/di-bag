"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ProviderExecution = exports.CompletedExecution = void 0;
const observePromise = (Promise.prototype.then);
const emptyFrames = Object.freeze([]);
const emptyWork = Object.freeze([]);
/** Fully drained borrowed attempts keep frames, but no execution closures or payloads. */
class CompletedExecution {
    frames;
    state = 'ready';
    sourceInFlight = false;
    hasOwnership = false;
    error = undefined;
    work = emptyWork;
    constructor(frames) {
        this.frames = frames;
    }
    inspectFrames() { return Object.freeze([...this.frames]); }
    async ready() { }
    async dispose() { }
    release() {
        // Frame-bearing records belong to one attempt; the shared empty record is
        // never mutated. Inspection arrays already returned to callers stay intact.
        if (this.frames.length)
            this.frames = emptyFrames;
    }
}
exports.CompletedExecution = CompletedExecution;
const completedWithoutFrames = new CompletedExecution(emptyFrames);
/** One source invocation and its ordered projections/ownership, local to an attempt. */
class ProviderExecution {
    events;
    context;
    frames;
    stages = [];
    pending = new Set();
    result;
    cleaning;
    // Source permission is independent of the exposed projection's cache state.
    sourceInFlight = true;
    constructor(events, description, context) {
        this.events = events;
        this.context = context;
        // Reserve every adapter slot before the source can reenter inspection.
        this.frames = description.operations.filter(operation => operation.kind === 'frame-sync' || operation.kind === 'frame-async')
            .map(() => Object.freeze({ present: false }));
    }
    inspectFrames() { return Object.freeze([...this.frames]); }
    get state() { return this.result?.state ?? 'failed'; }
    get error() { return this.result?.error; }
    get hasOwnership() { return this.stages.length > 0; }
    get work() { return [...this.pending]; }
    /** Observe the selected stage, retaining its failure even after retirement. */
    async ready() {
        const result = this.result;
        if (!result)
            throw new Error('acquisition has no result');
        if (result.state === 'pending')
            await result.settled;
        if (result.state === 'failed')
            throw result.error;
    }
    compact() {
        if (this.state !== 'ready' || this.pending.size || this.hasOwnership)
            return this;
        return this.frames.length ? new CompletedExecution(this.inspectFrames()) : completedWithoutFrames;
    }
    /** Classify/own only after the direct operation-free source call has returned. */
    publishSource(value, description) {
        if (description.acquisition === 'raw') {
            this.sourceInFlight = false;
            this.result = { exposed: undefined, consumed: true, state: 'ready', value: undefined, error: undefined, owners: [] };
            if (description.dispose)
                this.accept(0, value, description.dispose);
            return;
        }
        const stage = this.capture(() => value, true, description.acquisition);
        if (description.dispose)
            this.own(stage, 0, description.dispose);
        this.result = stage;
        this.consume(stage);
        if (stage.state === 'failed')
            throw stage.error;
    }
    evaluate(description, deps, acquisitionContext) {
        const { create, dispose } = description;
        let current = this.capture(() => description.contextual
            ? Reflect.apply(create, undefined, [deps, acquisitionContext()])
            : create(deps), true, description.acquisition);
        let nextFrame = 0;
        if (dispose)
            this.own(current, 0, dispose);
        description.operations.forEach((operation, offset) => {
            const inputStage = current;
            const index = offset + 1;
            if (operation.kind === 'owned') {
                this.own(current, index, operation.dispose);
            }
            else if (operation.kind === 'map-sync') {
                if (current.state !== 'failed') {
                    const input = current.exposed;
                    const { project } = operation;
                    current = this.capture(() => project(input), false, operation.acquisition);
                }
            }
            else if (operation.kind === 'map-async') {
                const input = current;
                const { project } = operation;
                current = this.capture(async () => {
                    if (input.state === 'failed')
                        throw input.error;
                    return project(await input.exposed);
                }, false, 'native');
            }
            else if (operation.kind === 'frame-sync' || operation.kind === 'frame-async') {
                const frameIndex = nextFrame++;
                const input = current;
                const { project } = operation;
                const apply = (value) => {
                    const projected = project(value);
                    this.frames[frameIndex] = Object.freeze({ present: true, value: projected.frame });
                    return projected.value;
                };
                if (operation.kind === 'frame-async') {
                    current = this.capture(async () => {
                        if (input.state === 'failed')
                            throw input.error;
                        return apply(await input.exposed);
                    }, false, 'native');
                }
                else if (input.state !== 'failed') {
                    current = this.capture(() => apply(input.exposed), false, operation.acquisition);
                }
            }
            if (current !== inputStage)
                this.consume(inputStage);
        });
        this.result = current;
        if (current.state === 'failed')
            throw current.error;
        const exposed = current.exposed;
        this.consume(current);
        return exposed;
    }
    consume(stage) {
        // Projections have captured their input and ownership has its own value.
        // Pending callbacks still accept ownership, but must not retain fulfillment.
        stage.consumed = true;
        stage.exposed = undefined;
        stage.value = undefined;
    }
    capture(create, source, mode) {
        try {
            const exposed = create();
            const stage = { exposed, consumed: false, state: 'ready', value: exposed, error: undefined, owners: [] };
            let native = mode === 'native';
            if (mode === 'auto') {
                const { isNativePromise } = this.context;
                // Whole-graph preflight establishes capability before invoking this factory.
                const classified = isNativePromise(exposed);
                if (typeof classified !== 'boolean')
                    throw new Error('isNativePromise must return a boolean');
                native = classified;
            }
            if (mode !== 'raw' && exposed !== null && (typeof exposed === 'object' || typeof exposed === 'function') && 'then' in exposed) {
                // Preserve original getter failures, but never use callability as native branding.
                const then = Reflect.get(exposed, 'then');
                if (!native && typeof then === 'function')
                    throw new TypeError('Structural thenables require explicit native conversion or raw acquisition');
            }
            if (native) {
                let settled;
                const barrier = new Promise(resolve => { settled = resolve; });
                // The species result is untrusted; only our independently made barrier
                // participates in draining. No structural assimilation or error fallback.
                observePromise.call(exposed, value => {
                    stage.state = 'ready';
                    if (!stage.consumed)
                        stage.value = value;
                    for (const owner of stage.owners)
                        this.accept(owner.index, value, owner.dispose);
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
                    if (source)
                        this.sourceInFlight = false;
                    this.pending.delete(barrier);
                    settled();
                    if (this.result === stage)
                        this.events.settled();
                    if (!this.pending.size)
                        this.events.drained();
                };
            }
            else if (source) {
                this.sourceInFlight = false;
            }
            return stage;
        }
        catch (error) {
            if (source)
                this.sourceInFlight = false;
            return { exposed: undefined, consumed: true, state: 'failed', value: undefined, error, owners: [] };
        }
    }
    own(stage, index, dispose) {
        if (stage.state === 'ready')
            this.accept(index, stage.value, dispose);
        else if (stage.state === 'pending')
            stage.owners.push({ index, dispose });
    }
    accept(index, value, dispose) {
        this.stages.push({ index, value, dispose, state: 'accepted' });
        this.events.accepted();
    }
    dispose() {
        if (this.cleaning)
            return this.cleaning;
        let complete;
        this.cleaning = new Promise(resolve => { complete = resolve; });
        // Publish before invoking user code, including synchronous finalizers.
        void this.disposeStages().then(complete);
        return this.cleaning;
    }
    async disposeStages() {
        // All later acceptances must be known before reversing stable stage indices.
        while (this.pending.size)
            await Promise.all(this.pending);
        const owned = this.stages.length > 0;
        let failed = false;
        if (owned)
            this.events.cleanupStarted?.();
        for (const stage of this.stages.sort((a, b) => b.index - a.index)) {
            stage.state = 'disposing';
            const sequence = this.events.invoking();
            const { dispose, value } = stage;
            try {
                await dispose(value);
            }
            catch (error) {
                failed = true;
                this.events.cleanupFailed(sequence, error);
            }
            finally {
                stage.state = 'disposed';
            }
        }
        if (owned)
            this.events.cleanupCompleted?.(failed ? 'failure' : 'success');
        this.stages.length = 0;
        this.result = undefined;
    }
    release() {
        this.frames.length = 0;
        this.stages.length = 0;
        this.pending.clear();
        this.result = undefined;
    }
}
exports.ProviderExecution = ProviderExecution;
