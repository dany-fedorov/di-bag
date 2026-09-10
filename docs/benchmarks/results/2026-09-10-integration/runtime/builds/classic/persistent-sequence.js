"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.append = append;
exports.materialize = materialize;
function append(previous, next) {
    return previous ? { left: previous, right: next } : next;
}
function materialize(sequence) {
    const values = [], stack = [sequence];
    while (stack.length) {
        const node = stack.pop();
        if ('values' in node)
            for (const value of node.values)
                values.push(value);
        else {
            stack.push(node.right, node.left);
        }
    }
    return Object.freeze(values);
}
