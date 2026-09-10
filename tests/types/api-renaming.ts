import { DiBag } from '../../src/node';
import type { ProviderOutput, ProviderAcquiredValue, ProviderRegistrationMetadata, ProviderAcquisitionMetadata, PluginProviderFactory, BagBuilder, DiBagApi, Registration } from '../../src';
type Equal<A, B> = (<T>() => T extends A ? 1 : 2) extends (<T>() => T extends B ? 1 : 2) ? true : false;
type Assert<T extends true> = T;
const pending = Promise.resolve({ id: 1 });
const raw = DiBag.fromFactory(() => pending, { acquisitionMode: 'raw' });
const direct = DiBag.withMetadata(raw, { static: { tag: 'x' as const }, dynamic: { mode: 'direct', describe: value => ({ pending: value }) } });
const awaited = DiBag.withMetadata(direct, { dynamic: { mode: 'awaited', describe: value => ({ id: value.id }) } });
type _Direct = Assert<Equal<ProviderOutput<typeof direct>, Promise<{ id: number }>>>;
type _Acquired = Assert<Equal<ProviderAcquiredValue<typeof direct>, Promise<{ id: number }>>>;
type _Static = Assert<Equal<ProviderRegistrationMetadata<typeof direct>['tag'], 'x'>>;
type _Frames = Assert<Equal<ProviderAcquisitionMetadata<typeof awaited>, readonly [Readonly<{ pending: Promise<{ id: number }> }>, Readonly<{ id: number }>]>>;
const mapped = DiBag.transformService(raw, { mode: 'direct', acquisitionMode: 'raw', transform: value => value });
type _Mapped = Assert<Equal<ProviderAcquiredValue<typeof mapped>, Promise<{ id: number }>>>;
const api: DiBagApi = DiBag.withConfiguration({});
const empty: BagBuilder<never> = api.createBuilder();
// Fast token overload selection must retain the reflected token call shape.
type _RegisterReflection = Assert<Equal<Parameters<typeof empty.register>['length'], 2>>;
// Explicit interface arguments can supply the required index through an intersection.
interface InterfaceRegistrations { value: () => number }
declare const interfaceRegistrations: InterfaceRegistrations & Record<string, Registration>;
const interfaceValue = empty.register<InterfaceRegistrations>(interfaceRegistrations).build().resolve('value');
type _InterfaceRegistration = Assert<Equal<typeof interfaceValue, number>>;
const numberKey = Symbol('number');
const numberToken = api.token(numberKey).of<number>();
const provider = api.fromFactory(({ number }: { number: number }, context) => ({ number, signal: context.signal }), { context: 'acquisition' });
const bag = empty.register(numberToken, () => 1).register({ number: () => 2, provider }).build();
const output: number = bag.resolve('provider').number;
const pluginFactory: PluginProviderFactory = api.fromPlugin;
void output; void pluginFactory;
export const nativeContext = DiBag.fromFactory((_deps: {}, context) => Promise.reject<never>(context.signal.reason), { context: 'acquisition', acquisitionMode: 'nativePromise' });
type _NativeContext = Assert<Equal<ProviderOutput<typeof nativeContext>, Promise<never>>>;

const optionalDirectOptions: {
  static?: { tag: string };
  dynamic: { mode: 'direct'; describe: (value: number) => { value: number } };
} = { dynamic: { mode: 'direct', describe: value => ({ value }) } };
const optionalDirect = DiBag.withMetadata(() => 1, optionalDirectOptions);
type _OptionalDirectStatic = Assert<Equal<ProviderRegistrationMetadata<typeof optionalDirect>['tag'], string | undefined>>;
type _OptionalDirectOutput = Assert<Equal<ProviderOutput<typeof optionalDirect>, number>>;
const optionalAwaitedOptions: {
  static?: { tag: string };
  dynamic: { mode: 'awaited'; describe: (value: number) => { value: number } };
} = { dynamic: { mode: 'awaited', describe: value => ({ value }) } };
const optionalAwaited = DiBag.withMetadata(() => Promise.resolve(1), optionalAwaitedOptions);
type _OptionalAwaitedStatic = Assert<Equal<ProviderRegistrationMetadata<typeof optionalAwaited>['tag'], string | undefined>>;
type _OptionalAwaitedOutput = Assert<Equal<ProviderOutput<typeof optionalAwaited>, Promise<number>>>;
const requiredAwaited = DiBag.withMetadata(() => 1, {
  static: { tag: 'awaited' as const }, dynamic: { mode: 'awaited', describe: value => ({ value }) },
});
type _RequiredAwaitedStatic = Assert<Equal<ProviderRegistrationMetadata<typeof requiredAwaited>['tag'], 'awaited'>>;

// An extracted callable must emit through the public PluginProviderFactory name.
export const extractedPluginFactory = DiBag.fromPlugin;
type _ExtractedPluginFactory = Assert<Equal<typeof extractedPluginFactory, PluginProviderFactory>>;
