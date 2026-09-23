import { createProvider } from './acquisition-context';
import type { Acquired, AutoOutput, FactoryReturnKind } from './acquisition-mode';
import type { Lifetime, LifetimeAdmission, LifetimeGraph, LifetimeOptions } from './lifetime';
import { selectLifetime } from './lifetime';
import { snapshotOptionsBag } from './options-bag';
import {
  addAcquisitionMetadata,
  addDisposal,
  addRegistrationMetadata,
  addTransformedService,
} from './provider';
import type {
  AcquisitionMetadataAdmission,
  CheckedTransformReturnKindOptions,
  MappedProviderFactory,
  MetadataKeys,
  Provider,
  ProviderAcquiredValue,
  ProviderAcquisitionMetadata,
  ProviderBase,
  ProviderFactory,
  ProviderGraphContract,
  ProviderOutput,
  RetainedMetadata,
} from './provider';
import type { Factory, ProviderOrFactory } from './registration';
import { describe } from './provider-operations';

type PlainFactoryOutput<R> = R extends infer T & {}
  ? T extends Factory ? ReturnType<T> : never
  : never;
type PlainFactoryAdmission<R> = AutoOutput<PlainFactoryOutput<R>, 'auto-detect'>;

function asProvider(provider: unknown, operation: string): ProviderBase {
  if (typeof provider === 'function') return createProvider(provider as never);
  describe(provider, operation);
  return provider as ProviderBase;
}

/**
 * Add an ownership stage whose disposer receives the provider input's acquired value.
 * Earlier stages run later in reverse order.
 * @typeParam ServiceProvider The plain factory or provider being decorated.
 * @param options The provider and disposer callback.
 * @returns A new frozen provider retaining every earlier stage.
 * @example
 * ```ts
 * const owned = DiBag.providerWithDisposal({ provider: () => ({ close() {} }), disposeService: service => service.close() });
 * ```
 */
export function providerWithDisposal<ServiceProvider extends ProviderOrFactory>(options: {
  readonly provider: ServiceProvider & PlainFactoryAdmission<NoInfer<ServiceProvider>>;
  readonly disposeService: (this: void, service: ProviderAcquiredValue<NoInfer<ServiceProvider>>) => void | Promise<void>;
}): Provider<ProviderFactory<ServiceProvider>, RetainedMetadata<ServiceProvider>, ProviderAcquisitionMetadata<ServiceProvider>, ProviderGraphContract<ServiceProvider>, ProviderAcquiredValue<ServiceProvider>>;
export function providerWithDisposal(options: unknown): ProviderBase {
  const { provider, disposeService } = snapshotOptionsBag(options, 'providerWithDisposal', ['provider', 'disposeService']);
  return addDisposal(asProvider(provider, 'providerWithDisposal'), disposeService, 'providerWithDisposal');
}

type CheckedFacadeLifetimeOptions<SelectedLifetime, Options> = {
  readonly [Key in keyof Options]: Key extends 'provider' | 'lifetime'
    ? unknown
    : Key extends keyof { readonly allowsScopedDependencies?: boolean }
      ? Required<Options>[Key] extends boolean
        ? Options[Key] & LifetimeOptions<SelectedLifetime, Pick<Options, Key>>
        : boolean
      : Options[Key] & LifetimeOptions<SelectedLifetime, Pick<Options, Key>>;
};

/**
 * Select one full caching policy. Only singleton may opt into scoped dependencies.
 * @typeParam ServiceProvider The plain factory or provider being decorated.
 * @typeParam SelectedLifetime The individually known full lifetime literal.
 * @typeParam Options The inferred option-field record; only singleton accepts allowsScopedDependencies.
 * @param options The provider, lifetime, and optional singleton capture policy.
 * @returns A new frozen provider carrying the selected graph contract.
 * @example
 * ```ts
 * const cached = DiBag.providerWithLifetime({ provider: () => 1, lifetime: 'singleton:one-per-container-tree' });
 * ```
 */
export function providerWithLifetime<
  ServiceProvider extends ProviderOrFactory,
  const SelectedLifetime extends Lifetime,
  const Options extends object = {},
>(options: {
  readonly provider: ServiceProvider & PlainFactoryAdmission<NoInfer<ServiceProvider>>;
  readonly lifetime: SelectedLifetime & LifetimeAdmission<SelectedLifetime>;
} & CheckedFacadeLifetimeOptions<NoInfer<SelectedLifetime>, Options>): Provider<ProviderFactory<ServiceProvider>, RetainedMetadata<ServiceProvider>, ProviderAcquisitionMetadata<ServiceProvider>, LifetimeGraph<ProviderGraphContract<ServiceProvider>, SelectedLifetime, Options>, ProviderAcquiredValue<ServiceProvider>>;
export function providerWithLifetime(options: unknown): ProviderBase {
  const bag = snapshotOptionsBag(options, 'providerWithLifetime', ['provider', 'lifetime'], ['allowsScopedDependencies']);
  const lifetimeOptions = Object.hasOwn(bag, 'allowsScopedDependencies') ? { allowsScopedDependencies: bag.allowsScopedDependencies } : undefined;
  return selectLifetime(asProvider(bag.provider, 'providerWithLifetime'), bag.lifetime, lifetimeOptions, 'providerWithLifetime');
}

/**
 * Add noncolliding registration metadata without acquiring the service.
 * The metadata is copied and frozen.
 * @typeParam ServiceProvider The plain factory or provider being decorated.
 * @typeParam AddedMetadata The metadata record appended to the retained contract.
 * @param options The provider and registration metadata.
 * @returns A new frozen provider carrying the merged metadata.
 * @example
 * ```ts
 * const registered = DiBag.providerWithRegistrationMetadata({ provider: () => 1, registrationMetadata: { owner: 'platform' } });
 * ```
 */
export function providerWithRegistrationMetadata<ServiceProvider extends ProviderOrFactory, AddedMetadata extends object>(options: {
  readonly provider: ServiceProvider & PlainFactoryAdmission<NoInfer<ServiceProvider>>;
  readonly registrationMetadata: AddedMetadata & MetadataKeys<NoInfer<ServiceProvider>, AddedMetadata>;
}): Provider<ProviderFactory<ServiceProvider>, Readonly<RetainedMetadata<ServiceProvider> & AddedMetadata>, ProviderAcquisitionMetadata<ServiceProvider>, ProviderGraphContract<ServiceProvider>, ProviderAcquiredValue<ServiceProvider>>;
export function providerWithRegistrationMetadata(options: unknown): ProviderBase {
  const { provider, registrationMetadata } = snapshotOptionsBag(options, 'providerWithRegistrationMetadata', ['provider', 'registrationMetadata']);
  return addRegistrationMetadata(asProvider(provider, 'providerWithRegistrationMetadata'), registrationMetadata, 'providerWithRegistrationMetadata');
}

/**
 * Append one synchronous acquisition-metadata frame using the exposed service.
 * @typeParam ServiceProvider The plain factory or provider being decorated.
 * @typeParam Describe The synchronous metadata callback.
 * @param options The provider, callback, and exposed-service input selection.
 * @returns A new frozen provider retaining the appended frame type.
 * @example
 * ```ts
 * const observed = DiBag.providerWithAcquisitionMetadata({ provider: () => 1, callbackReceives: 'exposed-service', describeAcquisition: value => ({ value }) });
 * ```
 */
export function providerWithAcquisitionMetadata<ServiceProvider extends ProviderOrFactory, Describe extends (this: void, service: ProviderOutput<NoInfer<ServiceProvider>>) => object>(options: {
  readonly provider: ServiceProvider & PlainFactoryAdmission<NoInfer<ServiceProvider>>;
  readonly describeAcquisition: Describe & AcquisitionMetadataAdmission<ReturnType<Describe>>;
  readonly callbackReceives: 'exposed-service';
}): Provider<ProviderFactory<ServiceProvider>, RetainedMetadata<ServiceProvider>, readonly [...ProviderAcquisitionMetadata<ServiceProvider>, Readonly<ReturnType<Describe>>], ProviderGraphContract<ServiceProvider>, ProviderAcquiredValue<ServiceProvider>>;
/**
 * Append an acquisition metadata frame after awaiting the exposed service.
 * @typeParam ServiceProvider The plain factory or provider being decorated.
 * @typeParam Describe The synchronous metadata callback for the fulfilled value.
 * @param options The provider, callback, and fulfilled-value input selection.
 * @returns A new frozen provider exposing a Promise and retaining the appended frame type.
 * @example
 * ```ts
 * const observed = DiBag.providerWithAcquisitionMetadata({ provider: async () => 1, callbackReceives: 'fulfilled-value', describeAcquisition: value => ({ value }) });
 * ```
 */
export function providerWithAcquisitionMetadata<ServiceProvider extends ProviderOrFactory, Describe extends (this: void, service: Awaited<ProviderOutput<NoInfer<ServiceProvider>>>) => object>(options: {
  readonly provider: ServiceProvider & PlainFactoryAdmission<NoInfer<ServiceProvider>>;
  readonly describeAcquisition: Describe & AcquisitionMetadataAdmission<ReturnType<Describe>>;
  readonly callbackReceives: 'fulfilled-value';
}): Provider<MappedProviderFactory<ProviderFactory<ServiceProvider>, Promise<Awaited<ProviderOutput<ServiceProvider>>>>, RetainedMetadata<ServiceProvider>, readonly [...ProviderAcquisitionMetadata<ServiceProvider>, Readonly<ReturnType<Describe>>], ProviderGraphContract<ServiceProvider>, Awaited<ProviderOutput<ServiceProvider>>>;
export function providerWithAcquisitionMetadata(options: unknown): ProviderBase {
  const { provider, describeAcquisition, callbackReceives } = snapshotOptionsBag(options, 'providerWithAcquisitionMetadata', ['provider', 'describeAcquisition', 'callbackReceives']);
  return addAcquisitionMetadata(asProvider(provider, 'providerWithAcquisitionMetadata'), { describeAcquisition, callbackReceives }, 'providerWithAcquisitionMetadata');
}

/**
 * Transform the selected fulfilled callback input while retaining every provider stage.
 * @typeParam ServiceProvider The plain factory or provider being decorated.
 * @typeParam Transform The transformation callback.
 * @typeParam CallbackReceives The callback input mode; this overload requires fulfilled-value.
 * @param options The provider, callback, and fulfilled-value input selection.
 * @returns A new frozen provider exposing the transformed Promise service.
 * @example
 * ```ts
 * const mapped = DiBag.providerWithTransformedService({ provider: async () => 1, callbackReceives: 'fulfilled-value', transformService: value => String(value) });
 * ```
 */
export function providerWithTransformedService<
  ServiceProvider extends ProviderOrFactory,
  Transform extends (this: void, service: NoInfer<CallbackReceives> extends 'fulfilled-value'
    ? Awaited<ProviderOutput<NoInfer<ServiceProvider>>> : ProviderOutput<NoInfer<ServiceProvider>>) => unknown,
  const CallbackReceives extends 'fulfilled-value' | 'exposed-service' = 'fulfilled-value',
>(options: {
  readonly provider: ServiceProvider & PlainFactoryAdmission<NoInfer<ServiceProvider>>;
  readonly transformService: Transform & ([NoInfer<CallbackReceives>] extends ['fulfilled-value'] ? unknown : never);
  readonly callbackReceives: CallbackReceives;
  readonly transformReturnKind?: never;
}): Provider<MappedProviderFactory<ProviderFactory<ServiceProvider>, Promise<Awaited<ReturnType<Transform>>>>, RetainedMetadata<ServiceProvider>, ProviderAcquisitionMetadata<ServiceProvider>, ProviderGraphContract<ServiceProvider>, Awaited<ReturnType<Transform>>>;
/**
 * Transform the exposed service while retaining dependencies, metadata, lifetime, and ownership.
 * @typeParam ServiceProvider The plain factory or provider being decorated.
 * @typeParam Transform The transformation callback receiving the exposed service.
 * @typeParam ReturnKind The return policy for the transformation callback.
 * @param options The provider, exposed-service callback, and return policy when required.
 * @returns A new frozen provider exposing the transformed service.
 * @example
 * ```ts
 * const mapped = DiBag.providerWithTransformedService({ provider: () => 1, callbackReceives: 'exposed-service', transformService: value => String(value) });
 * ```
 */
export function providerWithTransformedService<
  ServiceProvider extends ProviderOrFactory,
  Transform extends (this: void, service: ProviderOutput<NoInfer<ServiceProvider>>) => any,
  ReturnKind extends FactoryReturnKind = 'auto-detect',
>(options: {
  readonly provider: ServiceProvider & PlainFactoryAdmission<NoInfer<ServiceProvider>>;
  readonly transformService: Transform
    & AutoOutput<ReturnType<NoInfer<Transform>>, NoInfer<ReturnKind>>;
  readonly callbackReceives: 'exposed-service';
} & CheckedTransformReturnKindOptions<ReturnType<NoInfer<Transform>>, ReturnKind>): Provider<MappedProviderFactory<ProviderFactory<ServiceProvider>, ReturnType<Transform>>, RetainedMetadata<ServiceProvider>, ProviderAcquisitionMetadata<ServiceProvider>, ProviderGraphContract<ServiceProvider>, Acquired<ReturnType<Transform>, ReturnKind>>;
export function providerWithTransformedService(options: unknown): ProviderBase {
  const bag = snapshotOptionsBag(options, 'providerWithTransformedService', ['provider', 'transformService', 'callbackReceives'], ['transformReturnKind']);
  const transformed = Object.hasOwn(bag, 'transformReturnKind')
    ? { transformService: bag.transformService, callbackReceives: bag.callbackReceives, transformReturnKind: bag.transformReturnKind }
    : { transformService: bag.transformService, callbackReceives: bag.callbackReceives };
  return addTransformedService(asProvider(bag.provider, 'providerWithTransformedService'), transformed, 'providerWithTransformedService');
}
