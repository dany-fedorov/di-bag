/** Append/concat nodes contain no version-specific materialization cache. */
export type Sequence<T> = { readonly values: readonly T[] } | { readonly left: Sequence<T>; readonly right: Sequence<T> };
export function append<T>(previous: Sequence<T> | undefined, next: Sequence<T>): Sequence<T> {
  return previous ? { left: previous, right: next } : next;
}
export function materialize<T>(sequence: Sequence<T>): readonly T[] {
  const values: T[] = [], stack = [sequence];
  while (stack.length) {
    const node = stack.pop()!;
    if ('values' in node) for (const value of node.values) values.push(value);
    else { stack.push(node.right, node.left); }
  }
  return Object.freeze(values);
}
