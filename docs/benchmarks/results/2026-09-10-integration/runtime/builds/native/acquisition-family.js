"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AcquisitionFamily = void 0;
/** Family-wide identity and traversal only; finalizers stay with their owner. */
class AcquisitionFamily {
    attempts = new Map();
    incoming = new Map();
    constructing = [];
    // Only constructing/pending attempts can repeat an active binding+owner.
    active = new Map();
    add(attempt) {
        this.attempts.set(attempt.id, attempt);
        if (attempt.state !== 'creating' && attempt.state !== 'pending')
            return;
        let owners = this.active.get(attempt.bindingId);
        if (!owners)
            this.active.set(attempt.bindingId, owners = new Map());
        let ids = owners.get(attempt.ownerId);
        if (!ids)
            owners.set(attempt.ownerId, ids = new Set());
        ids.add(attempt.id);
    }
    deactivate(attempt) {
        const owners = this.active.get(attempt.bindingId);
        const ids = owners?.get(attempt.ownerId);
        if (!ids)
            return;
        ids.delete(attempt.id);
        if (!ids.size)
            owners.delete(attempt.ownerId);
        if (!owners.size)
            this.active.delete(attempt.bindingId);
    }
    release(attempt) {
        this.deactivate(attempt);
        // Remove this consumer from reverse indexes before its outgoing edges clear.
        for (const dependency of attempt.dependencies) {
            const consumers = this.incoming.get(dependency);
            consumers?.delete(attempt.id);
            if (consumers?.size === 0)
                this.incoming.delete(dependency);
        }
        this.incoming.delete(attempt.id);
        this.attempts.delete(attempt.id);
    }
    enter(attempt) { this.constructing.push(attempt.id); }
    leave() { this.constructing.pop(); }
    ancestry(bindingId, ownerId, label, from) {
        const source = from ?? this.attempts.get(this.constructing.at(-1));
        const ancestry = source ? { id: source.id, previous: source.ancestry } : undefined;
        // Most cold reads introduce an unrelated binding. Share history in O(1),
        // materializing the original label order only for a possible active cycle.
        if (!this.active.get(bindingId)?.has(ownerId))
            return ancestry;
        const history = [];
        for (let entry = ancestry; entry; entry = entry.previous)
            history.push(entry.id);
        history.reverse();
        // A public synchronous resolve has no proxy edge, but is still construction.
        const active = [...new Set([...history, ...this.constructing])]
            .map(id => this.attempts.get(id))
            .filter((attempt) => !!attempt && (attempt.state === 'creating' || attempt.state === 'pending'));
        const repeated = active.findIndex(attempt => attempt.bindingId === bindingId && attempt.ownerId === ownerId);
        if (repeated !== -1)
            throw new Error(`cycle: ${[...active.slice(repeated).map(attempt => attempt.label), label].join(' -> ')}`);
        return ancestry;
    }
    retireIncoming(attempt) {
        const consumers = this.incoming.get(attempt.id);
        if (!consumers)
            return;
        for (const id of consumers)
            this.attempts.get(id)?.dependencies.delete(attempt.id);
        this.incoming.delete(attempt.id);
    }
    recordEdge(from, to) {
        // A retained failed proxy may be used again, but its retired ID stays dead.
        if (!this.attempts.has(from.id))
            return;
        // Re-reading an existing edge cannot introduce a new cycle.
        if (from.dependencies.has(to.id))
            return;
        const path = this.path(to.id, from.id);
        if (path) {
            const labels = [...path, to.id].map(id => this.attempts.get(id).label);
            throw new Error(`cycle: ${labels.join(' -> ')}`);
        }
        from.dependencies.add(to.id);
        const consumers = this.incoming.get(to.id) ?? new Set();
        consumers.add(from.id);
        this.incoming.set(to.id, consumers);
    }
    path(from, to) {
        const attempt = this.attempts.get(from);
        if (!attempt)
            return undefined;
        if (from === to)
            return [from];
        if (attempt.dependencies.size === 0)
            return undefined;
        const seen = new Set([from]);
        const stack = [{ id: from, dependencies: attempt.dependencies.values() }];
        while (stack.length) {
            const next = stack[stack.length - 1].dependencies.next();
            if (next.done) {
                stack.pop();
                continue;
            }
            const dependency = this.attempts.get(next.value);
            if (!dependency)
                continue;
            if (next.value === to)
                return [...stack.map(frame => frame.id), to];
            if (seen.has(next.value))
                continue;
            seen.add(next.value);
            stack.push({ id: next.value, dependencies: dependency.dependencies.values() });
        }
        return undefined;
    }
}
exports.AcquisitionFamily = AcquisitionFamily;
