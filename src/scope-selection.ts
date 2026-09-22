import { libraryError } from './errors';
import type { BindingGraph, BindingKey, BindingId } from './runtime';
import { normalize } from './registration';
import type { Registration } from './registration';
import { readToken, wrongTokenKind } from './tokens';

type SelectedKey = {
  readonly key: BindingKey;
  readonly isCollection: boolean;
};

function snapshot(selection: unknown): SelectedKey[] {
  if (!Array.isArray(selection)) throw libraryError('DI_BAG_INVALID_SCOPE', 'createScope requires a selected key array', { operation: 'createScope' });
  const values: unknown[] = [];
  const length = selection.length;
  for (let index = 0; index < length; index++) values.push(selection[index]);
  return values.map(value => {
    if (typeof value === 'string') return { key: value, isCollection: false };
    const { key, kind } = readToken(value);
    return { key, isCollection: kind === 'collection' };
  });
}

/** Validate both selections before reading any override value or building a graph. */
export function selectScope(graph: BindingGraph, args: readonly unknown[], isTransient: (key: BindingKey) => boolean): {
  readonly graph: BindingGraph;
  readonly shared: readonly BindingId[];
} {
  if (args.length === 0) return { graph, shared: [] };
  if (args.length > 3) throw libraryError('DI_BAG_INVALID_SCOPE', 'createScope accepts sharing options or selected keys, overrides and optional sharing options', { operation: 'createScope' });
  const hasOverrides = args.length >= 2;
  const selectedKeys = hasOverrides ? snapshot(args[0]) : [];
  const selected = selectedKeys.map(entry => entry.key);
  const overrides = hasOverrides ? args[1] : undefined;
  if (hasOverrides && (typeof overrides !== 'object' || overrides === null || Array.isArray(overrides))) {
    throw libraryError('DI_BAG_INVALID_SCOPE', 'createScope requires an override object', { operation: 'createScope' });
  }
  const options = hasOverrides ? args[2] : args[0];
  let shareKeys: BindingKey[] = [];
  let sharedSelection: SelectedKey[] = [];
  if (options !== undefined || !hasOverrides) {
    if (typeof options !== 'object' || options === null || Array.isArray(options) ||
      ![Object.prototype, null].includes(Object.getPrototypeOf(options)) ||
      Reflect.ownKeys(options).some(key => key !== 'share') || !Object.hasOwn(options, 'share')) {
      throw libraryError('DI_BAG_INVALID_SCOPE', 'createScope options require only an own share selection', { operation: 'createScope' });
    }
    sharedSelection = snapshot(Reflect.get(options, 'share'));
    shareKeys = sharedSelection.map(entry => entry.key);
  }
  for (const { key, isCollection } of sharedSelection) {
    if (isCollection) throw wrongTokenKind('createScope', 'single-service', key as symbol);
  }
  for (const { key, isCollection } of [...selectedKeys, ...sharedSelection]) {
    if (!isCollection && !graph.hasPublic(key)) throw libraryError('DI_BAG_INVALID_SCOPE', `createScope accepts existing names or typed tokens only: ${String(key)}`, { operation: 'createScope' });
  }
  const selectedSet = new Set(selected);
  const shared = [...new Set(shareKeys)].map(key => {
    if (selectedSet.has(key)) throw libraryError('DI_BAG_INVALID_SCOPE', `createScope cannot share and override the same token: ${String(key)}`, { operation: 'createScope' });
    const id = graph.publicBinding(key);
    if (isTransient(key)) throw libraryError('DI_BAG_INVALID_SCOPE', `createScope cannot share transient providers: ${String(key)}`, { operation: 'createScope' });
    return id;
  });
  for (const key of selectedSet) {
    if (!Object.hasOwn(overrides!, key)) throw libraryError('DI_BAG_INVALID_SCOPE', `missing createScope override: ${String(key)}`, { operation: 'createScope' });
  }
  const bindings: Array<readonly [BindingKey, Registration]> = [];
  for (const key of selectedSet) {
    const registration: unknown = Reflect.get(overrides!, key);
    normalize(registration);
    bindings.push([key, registration as Registration]);
  }
  return { graph: graph.withPublicBindings(bindings), shared };
}
