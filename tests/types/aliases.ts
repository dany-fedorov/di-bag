import { DiBag, type ModuleRequiredServices, type BagBuilder } from '../../src';
import type { Assert, Equal } from './assert';
export const key = Symbol('source'); export const target = DiBag.token(key).of<{ id: number }>();
export const destinationKey = Symbol('destination'); export const destination = DiBag.token(destinationKey).of<{ id: number }>();
export const base = DiBag.createBuilder().register({ value: () => ({ id: 1, extra: true }) });
export const named = base.alias('copy', 'value');
export const bag = named.alias(destination, 'copy').build();
export const forward = DiBag.createBuilder().alias('forward', target);
export const complete = forward.register(target, () => ({ id: 1, extra: true })).alias(destination, target).build();
export const feature = DiBag.createModuleBuilder().alias('external', target).buildModule(['external']);
export const emptyFeature = DiBag.createModuleBuilder().alias('private', target).buildModule([]);
export const host = DiBag.createBuilder().installModule(feature);
export const emptyHost = DiBag.createBuilder().installModule(emptyFeature);
const copy = bag.resolve('copy'); const tokenValue = bag.resolve(destination); const declared = complete.resolve('forward');
export type Exact = [Assert<Equal<typeof copy, { id: number; extra: boolean }>>,
  Assert<Equal<typeof tokenValue, { id: number; extra: boolean }>>,
  Assert<Equal<typeof declared, { id: number }>>,
  Assert<Equal<ModuleRequiredServices<typeof feature>, Readonly<{ [key]: { id: number } }>>>,
  Assert<Equal<ModuleRequiredServices<typeof emptyFeature>, Readonly<{ [key]: { id: number } }>>>];
export const promisedKey = Symbol('promise'); export const promised = DiBag.token(promisedKey).of<Promise<number>>();
export const promiseBag = DiBag.createBuilder().alias('promise', promised).register(promised, DiBag.fromFactory(() => Promise.resolve(1), { acquisitionMode: 'raw' })).build();
const promise = promiseBag.resolve('promise');
export type PromiseExact = Assert<Equal<typeof promise, Promise<number>>>;
const aliasMethod: typeof base.alias = base.alias;
export const reflected = aliasMethod('other', 'value');
export const explicit = base.alias<'explicit', 'value'>('explicit', 'value');
export type ReflectedParameters = Parameters<typeof base.alias>;
export type ReflectedReturn = ReturnType<typeof base.alias>;
const root = DiBag.withLifetime(() => ({ id: 1 }), 'root');
const rootConsumer = DiBag.withLifetime(({ copy }: { copy: { id: number } }) => copy, 'root');
export const rootBag = DiBag.createBuilder().register({ root }).alias('copy', 'root').register({ rootConsumer }).build();
rootBag.createScope({ share: ['copy'] });
export const privateRoot = DiBag.createModuleBuilder().register({ root }).alias('copy', 'root').buildModule(['copy']).renameExport('copy', 'renamed');
DiBag.createBuilder().installModule(privateRoot).register({ rootConsumer: DiBag.withLifetime(({ renamed }: { renamed: { id: number } }) => renamed, 'root') }).build();
export const publicTarget = DiBag.createModuleBuilder().register({ value: () => ({ id: 1 }) }).alias('copy', 'value').buildModule(['copy', 'value']).renameExport('value', 'renamed');
export const publicTargetHost = DiBag.createBuilder().installModule(publicTarget);
const metadata = bag.inspect('copy').registrationMetadata;
const frames = bag.inspect('copy').acquisitions;
// @ts-expect-error alias inspection cannot promise target metadata keys
metadata.old;
// @ts-expect-error alias inspection cannot promise an empty canonical frame tuple
const exactFrames: readonly { metadata: readonly [] }[] = frames;

const scopedTarget = DiBag.createBuilder().register({ value: () => 1, consumer: ({ copy }: { copy: number }) => copy }).alias('copy', 'value').build();
export const scopedShared = scopedTarget.createScope(['value'], { value: DiBag.withLifetime(() => 2, 'root') }, { share: ['copy'] });
// Fresh grandchildren discard selected sharing and see their own root target.
scopedShared.createScope(['consumer'], { consumer: DiBag.withLifetime(({ copy }: { copy: number }) => copy, 'root') });
scopedShared.fork(['consumer'], { consumer: DiBag.withLifetime(({ copy }: { copy: number }) => copy, 'root') });
const rootedTarget = DiBag.createBuilder().register({ value: DiBag.withLifetime(() => 1, 'root'), consumer: ({ copy }: { copy: number }) => copy }).alias('copy', 'value').build();
export const rootShared = rootedTarget.createScope(['value'], { value: () => 2 }, { share: ['copy'] });
rootShared.createScope(['consumer'], { consumer: DiBag.withLifetime(({ copy }: { copy: number }) => copy, 'root') }, { share: ['copy'] });
export const sharedRootConsumer = rootedTarget.createScope(['value', 'consumer'], {
  value: () => 2, consumer: DiBag.withLifetime(({ copy }: { copy: number }) => copy, 'root'),
}, { share: ['copy'] });
const transientOverride = rootedTarget.createScope(['value'], { value: DiBag.withLifetime(() => 3, 'transient') }, { share: ['copy'] });
transientOverride.createScope({ share: ['copy'] });

type IsAny<T> = 0 extends (1 & T) ? true : false;
export type ReflectedExact = [Assert<Equal<IsAny<ReturnType<typeof base.alias>>, false>>,
  Assert<Equal<ReturnType<typeof base.alias>, typeof base>>];
const moduleBase = DiBag.createModuleBuilder().register({ value: () => 1 });
export type ModuleReflectedExact = [Assert<Equal<IsAny<ReturnType<typeof moduleBase.alias>>, false>>,
  Assert<Equal<ReturnType<typeof moduleBase.alias>, typeof moduleBase>>];
export function inferredAlias() { return base.alias('copy', 'value'); }
export function explicitAlias() { return base.alias<'copy', 'value'>('copy', 'value'); }
export type ConcreteUtilities = [Assert<Equal<ReturnType<typeof inferredAlias>, typeof named>>,
  Assert<Equal<ReturnType<typeof explicitAlias>, typeof named>>,
  Assert<Equal<IsAny<ReturnType<typeof inferredAlias>>, false>>];
declare const providerUnion: (() => 1) | (() => 2);
const unionOutput = DiBag.createBuilder().register({ value: providerUnion }).alias('copy', 'value').build().resolve('copy');
export type UnionOutput = Assert<Equal<typeof unionOutput, 1 | 2>>;
