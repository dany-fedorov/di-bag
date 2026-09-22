import { libraryError } from './errors';
import type { BindingGraph, BindingKey, BindingId } from './runtime';
import { normalize } from './registration';
import type { Registration } from './registration';
import { snapshotOptionsBag } from './options-bag';
import { readToken, wrongTokenKind } from './tokens';
import type { TokenKind } from './tokens';

type SelectedKey = {
  readonly key: BindingKey;
  readonly isCollection: boolean;
};

function claimSelectedTokenKinds(
  graph: BindingGraph,
  values: readonly SelectedKey[],
  operation: string,
): BindingGraph {
  let claimed = graph;
  for (const value of values) {
    if (typeof value.key === 'string') continue;
    claimed = claimed.withTokenKind(
      value.key,
      value.isCollection ? 'collection' : 'single-service',
      operation,
    );
  }
  return claimed;
}

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
  const workingGraph = claimSelectedTokenKinds(
    claimSelectedTokenKinds(graph, selectedKeys, 'createScope'),
    sharedSelection,
    'createScope',
  );
  for (const { key, isCollection } of sharedSelection) {
    if (isCollection) throw wrongTokenKind('createScope', 'single-service', key as symbol);
  }
  for (const { key, isCollection } of [...selectedKeys, ...sharedSelection]) {
    if (!isCollection && !workingGraph.hasPublic(key)) throw libraryError('DI_BAG_INVALID_SCOPE', `createScope accepts existing names or typed tokens only: ${String(key)}`, { operation: 'createScope' });
  }
  const selectedSet = new Set(selected);
  const shared = [...new Set(shareKeys)].map(key => {
    if (selectedSet.has(key)) throw libraryError('DI_BAG_INVALID_SCOPE', `createScope cannot share and override the same token: ${String(key)}`, { operation: 'createScope' });
    const id = workingGraph.publicBinding(key);
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
  return { graph: workingGraph.withPublicBindings(bindings, 'createScope'), shared };
}

type ContainerSelectedKey = {
  readonly key: BindingKey;
  readonly tokenKind: TokenKind | undefined;
  readonly isCollection: boolean;
};

function snapshotSelection(selection: unknown, operation: string, argument: string): ContainerSelectedKey[] {
  if (!Array.isArray(selection)) {
    throw libraryError('DI_BAG_INVALID_ARGUMENT', `${operation} requires ${argument} to be an array`, {
      operation, argument, expected: 'an array',
    });
  }
  const values: unknown[] = [];
  const length = selection.length;
  for (let index = 0; index < length; index++) values[index] = selection[index];
  return values.map(value => {
    if (typeof value === 'string') return { key: value, tokenKind: undefined, isCollection: false };
    const { key, kind } = readToken(value);
    return { key, tokenKind: kind, isCollection: kind === 'collection' };
  });
}

function claimContainerSelectionTokenKinds(
  graph: BindingGraph,
  selected: readonly ContainerSelectedKey[],
  operation: string,
): BindingGraph {
  let claimed = graph;
  for (const { key, tokenKind } of selected) {
    if (tokenKind !== undefined) claimed = claimed.withTokenKind(key as symbol, tokenKind, operation);
  }
  return claimed;
}

function selectedBindings(
  graph: BindingGraph,
  operation: string,
  selected: readonly ContainerSelectedKey[],
  providers: unknown,
): Array<readonly [BindingKey, Registration]> {
  if (typeof providers !== 'object' || providers === null || Array.isArray(providers)) {
    throw libraryError('DI_BAG_INVALID_ARGUMENT', `${operation} requires replacementProviders to be an object`, {
      operation, argument: 'replacementProviders', expected: 'an object',
    });
  }
  for (const { key, isCollection } of selected) {
    if (!isCollection && !graph.hasPublic(key)) {
      throw libraryError('DI_BAG_INVALID_OVERRIDE', `${operation} accepts existing names or typed tokens only: ${String(key)}`, { operation });
    }
    if (!Object.hasOwn(providers, key)) {
      throw libraryError('DI_BAG_INVALID_OVERRIDE', `missing ${operation} replacement provider: ${String(key)}`, { operation });
    }
  }
  const bindings: Array<readonly [BindingKey, Registration]> = [];
  const seen = new Set<BindingKey>();
  for (const { key } of selected) {
    if (seen.has(key)) continue;
    seen.add(key);
    const registration: unknown = Reflect.get(providers, key);
    normalize(registration, operation);
    bindings.push([key, registration as Registration]);
  }
  return bindings;
}

function replacementPair(options: Record<string, unknown>, operation: string): {
  readonly present: boolean;
  readonly selected: readonly ContainerSelectedKey[];
  readonly providers: unknown;
} {
  const hasKeys = Object.hasOwn(options, 'replacedServiceKeys');
  const hasProviders = Object.hasOwn(options, 'replacementProviders');
  if (hasKeys !== hasProviders) {
    const argument = hasKeys ? 'replacementProviders' : 'replacedServiceKeys';
    throw libraryError('DI_BAG_INVALID_ARGUMENT', `${operation} requires replacedServiceKeys and replacementProviders together`, {
      operation, argument, expected: 'present',
    });
  }
  return hasKeys
    ? { present: true, selected: snapshotSelection(options.replacedServiceKeys, operation, 'replacedServiceKeys'), providers: options.replacementProviders }
    : { present: false, selected: [], providers: undefined };
}

export function selectIndependentContainer(graph: BindingGraph, options: unknown): BindingGraph {
  if (options === undefined) return graph;
  const bag = snapshotOptionsBag(options, 'createIndependentContainer', [], ['replacedServiceKeys', 'replacementProviders']);
  const { present, selected, providers } = replacementPair(bag, 'createIndependentContainer');
  if (!present) return graph;
  const selectedGraph = claimContainerSelectionTokenKinds(graph, selected, 'createIndependentContainer');
  const bindings = selectedBindings(selectedGraph, 'createIndependentContainer', selected, providers);
  return selectedGraph.withPublicBindings(bindings, 'createIndependentContainer');
}

export function selectChildContainer(
  graph: BindingGraph,
  options: unknown,
  isTransient: (serviceKey: BindingKey) => boolean,
): { readonly graph: BindingGraph; readonly shared: readonly BindingId[] } {
  if (options === undefined) return { graph, shared: [] };
  const bag = snapshotOptionsBag(options, 'createChildContainer', [], [
    'replacedServiceKeys', 'replacementProviders', 'sharedParentServiceKeys',
  ]);
  const { present, selected, providers } = replacementPair(bag, 'createChildContainer');
  const sharedKeys = Object.hasOwn(bag, 'sharedParentServiceKeys')
    ? snapshotSelection(bag.sharedParentServiceKeys, 'createChildContainer', 'sharedParentServiceKeys')
    : [];
  const workingGraph = claimContainerSelectionTokenKinds(
    claimContainerSelectionTokenKinds(graph, selected, 'createChildContainer'),
    sharedKeys,
    'createChildContainer',
  );
  for (const { key, isCollection } of sharedKeys) {
    if (isCollection) throw wrongTokenKind('createChildContainer', 'single-service', key as symbol);
  }
  for (const { key, isCollection } of [...selected, ...sharedKeys]) {
    if (!isCollection && !workingGraph.hasPublic(key)) {
      throw libraryError('DI_BAG_INVALID_SCOPE', `createChildContainer accepts existing names or typed tokens only: ${String(key)}`, { operation: 'createChildContainer' });
    }
  }
  const selectedSet = new Set(selected.map(entry => entry.key));
  const shared = [...new Set(sharedKeys.map(entry => entry.key))].map(key => {
    if (selectedSet.has(key)) {
      throw libraryError('DI_BAG_INVALID_SCOPE', `createChildContainer cannot share and replace the same service: ${String(key)}`, { operation: 'createChildContainer' });
    }
    if (isTransient(key)) {
      throw libraryError('DI_BAG_INVALID_SCOPE', `createChildContainer cannot share transient providers: ${String(key)}`, { operation: 'createChildContainer' });
    }
    return workingGraph.publicBinding(key);
  });
  const bindings = present ? selectedBindings(workingGraph, 'createChildContainer', selected, providers) : [];
  return {
    graph: bindings.length === 0 ? workingGraph : workingGraph.withPublicBindings(bindings, 'createChildContainer'),
    shared,
  };
}
