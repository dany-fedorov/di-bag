import { libraryError } from './errors';
import type { BindingGraph, BindingKey, BindingId } from './runtime';
import { normalize } from './registration';
import type { ProviderOrFactory } from './registration';
import { snapshotOptionsBag } from './options-bag';
import { readToken, wrongTokenKind } from './tokens';
import type { TokenKind } from './tokens';
import type { LifetimeKind } from './lifetime';

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
): Array<readonly [BindingKey, ProviderOrFactory]> {
  if (typeof providers !== 'object' || providers === null || Array.isArray(providers)) {
    throw libraryError('DI_BAG_INVALID_ARGUMENT', `${operation} requires replacementProviders to be an object`, {
      operation, argument: 'replacementProviders', expected: 'an object',
    });
  }
  for (const { key, isCollection } of selected) {
    if (!isCollection && !graph.hasPublic(key)) {
      throw libraryError('DI_BAG_UNKNOWN_SERVICE_KEY', `${operation} accepts existing names or typed tokens only: ${String(key)}`, { operation, serviceKey: key });
    }
    if (!Object.hasOwn(providers, key)) {
      throw libraryError('DI_BAG_MISSING_REPLACEMENT_PROVIDER', `missing ${operation} replacement provider: ${String(key)}`, { operation, serviceKey: key });
    }
  }
  const bindings: Array<readonly [BindingKey, ProviderOrFactory]> = [];
  const seen = new Set<BindingKey>();
  for (const { key } of selected) {
    if (seen.has(key)) continue;
    seen.add(key);
    const registration: unknown = Reflect.get(providers, key);
    normalize(registration, operation);
    bindings.push([key, registration as ProviderOrFactory]);
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
  lifetimeOf: (serviceKey: BindingKey) => LifetimeKind,
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
      throw libraryError('DI_BAG_UNKNOWN_SERVICE_KEY', `createChildContainer accepts existing names or typed tokens only: ${String(key)}`, { operation: 'createChildContainer', serviceKey: key });
    }
  }
  const selectedSet = new Set(selected.map(entry => entry.key));
  const shared = [...new Set(sharedKeys.map(entry => entry.key))].map(key => {
    if (selectedSet.has(key)) {
      throw libraryError('DI_BAG_CONFLICTING_SERVICE_SELECTION', `createChildContainer cannot share and replace the same service: ${String(key)}`, { operation: 'createChildContainer', serviceKey: key, conflict: 'shared-and-replaced' });
    }
    if (lifetimeOf(key) === 'transient') {
      throw libraryError('DI_BAG_CONFLICTING_SERVICE_SELECTION', `createChildContainer cannot share transient providers: ${String(key)}`, { operation: 'createChildContainer', serviceKey: key, conflict: 'shared-transient' });
    }
    return workingGraph.publicBinding(key);
  });
  for (const { key: serviceKey, isCollection } of selected) {
    if (!isCollection && lifetimeOf(serviceKey) === 'singleton') {
      throw libraryError(
        'DI_BAG_SINGLETON_REPLACEMENT',
        `createChildContainer cannot replace singleton service '${String(serviceKey)}'; mark it 'scoped:one-per-container' or use createIndependentContainer`,
        { operation: 'createChildContainer', serviceKey },
      );
    }
  }
  const bindings = present ? selectedBindings(workingGraph, 'createChildContainer', selected, providers) : [];
  return {
    graph: bindings.length === 0 ? workingGraph : workingGraph.withPublicBindings(bindings, 'createChildContainer'),
    shared,
  };
}
