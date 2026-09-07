import type { BindingGraph, BindingKey, BindingId } from './runtime';
import { normalize } from './registration';
import type { Registration } from './registration';
import { readTokenKey } from './tokens';

function snapshot(selection: unknown): BindingKey[] {
  if (!Array.isArray(selection)) throw new Error('scope requires a selected key array');
  const values: unknown[] = [];
  const length = selection.length;
  for (let index = 0; index < length; index++) values.push(selection[index]);
  return values.map(value => typeof value === 'string' ? value : readTokenKey(value));
}

/** Validate both selections before reading any override value or building a graph. */
export function selectScope(graph: BindingGraph, args: readonly unknown[], isTransient: (key: BindingKey) => boolean): {
  readonly graph: BindingGraph;
  readonly shared: readonly BindingId[];
} {
  if (args.length === 0) return { graph, shared: [] };
  if (args.length > 3) throw new Error('scope accepts sharing options or selected keys, overrides and optional sharing options');
  const hasOverrides = args.length >= 2;
  const selected = hasOverrides ? snapshot(args[0]) : [];
  const overrides = hasOverrides ? args[1] : undefined;
  if (hasOverrides && (typeof overrides !== 'object' || overrides === null || Array.isArray(overrides))) {
    throw new Error('scope requires an override object');
  }
  const options = hasOverrides ? args[2] : args[0];
  let shareKeys: BindingKey[] = [];
  if (options !== undefined || !hasOverrides) {
    if (typeof options !== 'object' || options === null || Array.isArray(options) ||
      ![Object.prototype, null].includes(Object.getPrototypeOf(options)) ||
      Reflect.ownKeys(options).some(key => key !== 'share') || !Object.hasOwn(options, 'share')) {
      throw new Error('scope options require only an own share selection');
    }
    shareKeys = snapshot(Reflect.get(options, 'share'));
  }
  for (const key of [...selected, ...shareKeys]) {
    if (!graph.hasPublic(key)) throw new Error(`scope accepts existing tokens only: ${String(key)}`);
  }
  const selectedSet = new Set(selected);
  const shared = [...new Set(shareKeys)].map(key => {
    if (selectedSet.has(key)) throw new Error(`scope cannot share and override the same token: ${String(key)}`);
    const id = graph.publicBinding(key);
    if (isTransient(key)) throw new Error(`scope cannot share transient providers: ${String(key)}`);
    return id;
  });
  for (const key of selectedSet) {
    if (!Object.hasOwn(overrides!, key)) throw new Error(`missing scope override: ${String(key)}`);
  }
  const bindings: Array<readonly [BindingKey, Registration]> = [];
  for (const key of selectedSet) {
    const registration: unknown = Reflect.get(overrides!, key);
    normalize(registration);
    bindings.push([key, registration as Registration]);
  }
  return { graph: graph.withPublicBindings(bindings), shared };
}
