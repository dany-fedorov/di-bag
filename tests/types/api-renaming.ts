import { DiBag } from '../../src';
import type { ProviderOutput, ProviderAcquiredValue, ProviderRegistrationMetadata, ProviderAcquisitionMetadata, CreateProviderFromPlugin, Builder, DiBagApi, ProviderOrFactory } from '../../src';
type Equal<A, B> = (<T>() => T extends A ? 1 : 2) extends (<T>() => T extends B ? 1 : 2) ? true : false;
type Assert<T extends true> = T;
const pending = Promise.resolve({ id: 1 });
const raw = DiBag.createProvider(() => pending, { factoryReturnKind: 'uninspected' });
const direct = DiBag.providerWithAcquisitionMetadata({ provider: DiBag.providerWithRegistrationMetadata({ provider: raw, registrationMetadata: { tag: 'x' as const } }), callbackReceives: 'exposed-service', describeAcquisition: value => ({ pending: value }) });
const awaited = DiBag.providerWithAcquisitionMetadata({ provider: direct, describeAcquisition: value => ({ id: value.id }), callbackReceives: 'fulfilled-value' });
type _Direct = Assert<Equal<ProviderOutput<typeof direct>, Promise<{ id: number }>>>;
type _Acquired = Assert<Equal<ProviderAcquiredValue<typeof direct>, Promise<{ id: number }>>>;
type _Static = Assert<Equal<ProviderRegistrationMetadata<typeof direct>['tag'], 'x'>>;
type _Frames = Assert<Equal<ProviderAcquisitionMetadata<typeof awaited>, readonly [Readonly<{ pending: Promise<{ id: number }> }>, Readonly<{ id: number }>]>>;
const mapped = DiBag.providerWithTransformedService({ provider: raw, transformService: value => value, callbackReceives: 'exposed-service', transformReturnKind: 'uninspected' });
type _Mapped = Assert<Equal<ProviderAcquiredValue<typeof mapped>, Promise<{ id: number }>>>;
const api: DiBagApi = DiBag.withConfiguration({});
const empty: Builder<never> = api.createBuilder();
// The positional token-service facade must retain its reflected two-parameter call shape.
type _RegisterReflection = Assert<Equal<Parameters<typeof empty.withTokenService>['length'], 2>>;
// Explicit interface arguments can supply the required index through an intersection.
interface InterfaceRegistrations { value: () => number }
declare const interfaceRegistrations: InterfaceRegistrations & Record<string, ProviderOrFactory>;
const interfaceValue = empty.withServices<InterfaceRegistrations>(interfaceRegistrations).buildContainer().resolve('value');
type _InterfaceRegistration = Assert<Equal<typeof interfaceValue, number>>;
const numberKey = Symbol('number');
const numberToken = api.createToken(numberKey).forService<number>();
const provider = api.createProvider(({ number }: { number: number }, context) => ({ number, signal: context.abortSignal }), { factoryReceivesContext: true });
const bag = empty.withTokenService(numberToken, () => 1).withServices({ number: () => 2, provider }).buildContainer();
const output: number = bag.resolve('provider').number;
const pluginFactory: CreateProviderFromPlugin = api.createProviderFromPlugin;
void output; void pluginFactory;
export const nativeContext = DiBag.createProvider((_deps: {}, context) => Promise.reject<never>(context.abortSignal.reason), { factoryReturnKind: 'native-promise', factoryReceivesContext: true });
type _NativeContext = Assert<Equal<ProviderOutput<typeof nativeContext>, Promise<never>>>;

const optionalDirect = DiBag.providerWithAcquisitionMetadata({ provider: () => 1, callbackReceives: 'exposed-service', describeAcquisition: value => ({ value }) });
type _OptionalDirectOutput = Assert<Equal<ProviderOutput<typeof optionalDirect>, number>>;
const optionalAwaited = DiBag.providerWithAcquisitionMetadata({ provider: () => Promise.resolve(1), callbackReceives: 'fulfilled-value', describeAcquisition: value => ({ value }) });
type _OptionalAwaitedOutput = Assert<Equal<ProviderOutput<typeof optionalAwaited>, Promise<number>>>;
const requiredAwaited = DiBag.providerWithAcquisitionMetadata({
  provider: DiBag.providerWithRegistrationMetadata({ provider: () => 1, registrationMetadata: { tag: 'awaited' as const } }), callbackReceives: 'fulfilled-value', describeAcquisition: value => ({ value }),
});
type _RequiredAwaitedStatic = Assert<Equal<ProviderRegistrationMetadata<typeof requiredAwaited>['tag'], 'awaited'>>;

// An extracted callable must emit through the public CreateProviderFromPlugin name.
export const extractedPluginFactory = DiBag.createProviderFromPlugin;
type _ExtractedPluginFactory = Assert<Equal<typeof extractedPluginFactory, CreateProviderFromPlugin>>;
