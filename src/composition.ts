import { libraryError } from './errors';
import { factoryReturnKind } from './acquisition-mode';
import type { Acquired, AutoOutput, FactoryReturnKind, NativeOutput, ReturnKindOptions, SyncOutput } from './acquisition-mode';
import type { FactoryContext } from './acquisition-context';
import { createProvider } from './provider';
import type { Provider, ProviderBase } from './provider';
import { retainDescription, sourceDescription } from './provider-operations';
import { snapshotReferences } from './dependency-references';
import { snapshotOptionsBag } from './options-bag';
import type { DependencyReference } from './dependency-references';
import type { TokenArguments, ReferenceGraph, DependencyTupleAdmission } from './token-types';
import type { Unsatisfied } from './types';

// Capture synthetic outputs independently of the retained callback type.
type OutputFactory<O> = () => O;

/**
 * Admit only a callable parameter tuple that can receive the selected dependency values.
 * @typeParam Supplied - Values obtained from the dependency tuple.
 * @typeParam Parameters_ - The callable's declared parameters.
 */
export type PositionalFactoryArguments<
  Supplied extends readonly unknown[],
  Parameters_ extends readonly unknown[],
> = [Supplied] extends [Parameters_]
  ? unknown
  : Unsatisfied<'positional factory arguments must match the declared parameter tuple', { supplied: Supplied; parameters: Parameters_ }>;

type FactoryContextArguments<ReceivesContext extends boolean> =
  ReceivesContext extends true ? [factoryContext: FactoryContext] : [];

type PositionalArguments<
  Dependencies extends readonly DependencyReference[],
  ReceivesContext extends boolean,
> = TokenArguments<Dependencies> extends [...infer Arguments]
  ? [...Arguments, ...FactoryContextArguments<ReceivesContext>]
  : never;

/**
 * A receiver-free callable whose arguments follow the selected dependency tuple.
 * @typeParam Dependencies - The dependency references supplying the positional values.
 * @typeParam Output - The exact callback output.
 * @typeParam ReceivesContext - Whether FactoryContext follows the dependency values.
 */
export type PositionalFactoryFunction<
  Dependencies extends readonly DependencyReference[],
  Output = unknown,
  ReceivesContext extends boolean = false,
> = PositionalArguments<Dependencies, ReceivesContext> extends infer Arguments extends unknown[]
  ? (this: void, ...arguments_: Arguments) => Output
  : never;

type ContextSelection<ReceivesContext extends boolean> = ReceivesContext extends true
  ? { readonly factoryReceivesContext: true }
  : { readonly factoryReceivesContext?: never };

type PositionalReturnKindAdmission<Output, ReturnKind extends FactoryReturnKind> =
  NativeOutput<Output, NoInfer<ReturnKind>>
  & SyncOutput<Output, NoInfer<ReturnKind>>;

type CheckedPositionalReturnKindOptions<Output, ReturnKind extends FactoryReturnKind> =
  'auto-detect' extends ReturnKind
    ? unknown extends PositionalReturnKindAdmission<Output, ReturnKind>
      ? { readonly factoryReturnKind?: ReturnKind & PositionalReturnKindAdmission<Output, ReturnKind> }
      : { readonly factoryReturnKind: ReturnKind & PositionalReturnKindAdmission<Output, ReturnKind> }
    : { readonly factoryReturnKind: ReturnKind & PositionalReturnKindAdmission<Output, ReturnKind> };

/**
 * Create a provider by passing positional dependency values to a receiver-free function.
 * @typeParam Dependencies - The finite tuple of dependency references.
 * @typeParam FactoryFunction - The exact callback signature and output.
 * @typeParam ReturnKind - How the output is acquired.
 * @typeParam ReceivesContext - Whether FactoryContext is appended after dependency values.
 */
export function createProviderFromFunction<
  const Dependencies extends readonly DependencyReference[],
  FactoryFunction extends PositionalFactoryFunction<NoInfer<Dependencies>, any, NoInfer<ReceivesContext>>,
  ReturnKind extends FactoryReturnKind = 'auto-detect',
  ReceivesContext extends boolean = false,
>(options: {
  readonly dependencies: Dependencies & DependencyTupleAdmission<Dependencies>;
  readonly factoryReceivesContext?: ReceivesContext;
  readonly factoryFunction: FactoryFunction
    & PositionalFactoryArguments<PositionalArguments<NoInfer<Dependencies>, NoInfer<ReceivesContext>>, Parameters<NoInfer<FactoryFunction>>>
    & AutoOutput<ReturnType<NoInfer<FactoryFunction>>, NoInfer<ReturnKind>>;
} & ContextSelection<NoInfer<ReceivesContext>>
  & CheckedPositionalReturnKindOptions<ReturnType<NoInfer<FactoryFunction>>, ReturnKind>):
  Provider<OutputFactory<ReturnType<FactoryFunction>>, Readonly<{}>, readonly [], ReferenceGraph<Dependencies>, Acquired<ReturnType<FactoryFunction>, ReturnKind>>;

export function createProviderFromFunction(options: unknown): ProviderBase {
  const bag = snapshotOptionsBag(options, 'createProviderFromFunction', ['dependencies', 'factoryFunction'], ['factoryReturnKind', 'factoryReceivesContext']);
  if (!Array.isArray(bag.dependencies)) throw libraryError(
    'DI_BAG_INVALID_ARGUMENT', 'createProviderFromFunction dependencies must be an array',
    { operation: 'createProviderFromFunction', argument: 'dependencies', expected: 'an array' },
  );
  const references = snapshotReferences(bag.dependencies);
  if (typeof bag.factoryFunction !== 'function') throw libraryError(
    'DI_BAG_INVALID_ARGUMENT', 'createProviderFromFunction requires a factory function',
    { operation: 'createProviderFromFunction', argument: 'factoryFunction', expected: 'a function' },
  );
  if (bag.factoryReceivesContext !== undefined && bag.factoryReceivesContext !== true) throw libraryError(
    'DI_BAG_INVALID_ARGUMENT', 'createProviderFromFunction factoryReceivesContext must be true when present',
    { operation: 'createProviderFromFunction', argument: 'factoryReceivesContext', expected: "one of: 'true'" },
  );
  const returnKind = factoryReturnKind(bag.factoryReturnKind, 'createProviderFromFunction');
  const contextual = bag.factoryReceivesContext === true;
  const factoryFunction = bag.factoryFunction as (...arguments_: readonly unknown[]) => unknown;
  const create = (dependencies: Record<symbol, unknown>, factoryContext?: FactoryContext) => Reflect.apply(
    factoryFunction,
    undefined,
    contextual
      ? [...references.map(reference => Reflect.get(dependencies, reference.slot)), factoryContext!]
      : references.map(reference => Reflect.get(dependencies, reference.slot)),
  );
  const handle = createProvider<OutputFactory<unknown>, Readonly<{}>, readonly [], ReferenceGraph<readonly DependencyReference[]>, unknown>();
  retainDescription(handle, sourceDescription(create, undefined, references.map(reference => reference.key), returnKind, contextual, references));
  return handle;
}

type PositionalClassOptions<
  Dependencies extends readonly DependencyReference[],
  ServiceClass,
  ReturnKind extends FactoryReturnKind,
> = {
  readonly dependencies: Dependencies & DependencyTupleAdmission<Dependencies>;
  readonly serviceClass: ServiceClass;
} & ReturnKindOptions<ReturnKind>;

export function createProviderFromClass<
  const Dependencies extends readonly DependencyReference[],
  ServiceClass extends new (...arguments_: TokenArguments<NoInfer<Dependencies>>) => unknown,
  ReturnKind extends FactoryReturnKind = 'auto-detect',
>(options: PositionalClassOptions<Dependencies, ServiceClass &
  PositionalFactoryArguments<TokenArguments<NoInfer<Dependencies>>, ConstructorParameters<NoInfer<ServiceClass>>> &
  NativeOutput<InstanceType<NoInfer<ServiceClass>>, NoInfer<ReturnKind>> &
  AutoOutput<InstanceType<NoInfer<ServiceClass>>, NoInfer<ReturnKind>> &
  SyncOutput<InstanceType<NoInfer<ServiceClass>>, NoInfer<ReturnKind>>, ReturnKind>):
  Provider<() => InstanceType<ServiceClass>, Readonly<{}>, readonly [], ReferenceGraph<Dependencies>, Acquired<InstanceType<ServiceClass>, ReturnKind>>;

export function createProviderFromClass(options: unknown): ProviderBase {
  const bag = snapshotOptionsBag(options, 'createProviderFromClass', ['dependencies', 'serviceClass'], ['factoryReturnKind']);
  if (!Array.isArray(bag.dependencies)) throw libraryError(
    'DI_BAG_INVALID_ARGUMENT', 'createProviderFromClass dependencies must be an array',
    { operation: 'createProviderFromClass', argument: 'dependencies', expected: 'an array' },
  );
  const references = snapshotReferences(bag.dependencies);
  if (typeof bag.serviceClass !== 'function') throw invalidServiceClass();
  try { Reflect.construct(new Proxy(bag.serviceClass, { construct: () => ({}) }), []); }
  catch { throw invalidServiceClass(); }
  const serviceClass = bag.serviceClass as new (...arguments_: readonly unknown[]) => unknown;
  const returnKind = factoryReturnKind(bag.factoryReturnKind, 'createProviderFromClass');
  const create = (dependencies: Record<symbol, unknown>) => Reflect.construct(
    serviceClass,
    references.map(reference => Reflect.get(dependencies, reference.slot)),
  );
  const handle = createProvider<() => unknown, Readonly<{}>, readonly [], ReferenceGraph<readonly DependencyReference[]>, unknown>();
  retainDescription(handle, sourceDescription(create, undefined, references.map(reference => reference.key), returnKind, false, references));
  return handle;
}

function invalidServiceClass(): Error {
  return libraryError('DI_BAG_INVALID_ARGUMENT', 'createProviderFromClass requires a concrete constructor', {
    operation: 'createProviderFromClass', argument: 'serviceClass', expected: 'a constructor that can be called with new',
  });
}
