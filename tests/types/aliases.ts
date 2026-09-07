import { DiBag, type ModuleRequires, type Builder } from '../../src';
import type { Assert, Equal } from './assert';
export const key = Symbol('source'); export const target = DiBag.token(key).of<{ id: number }>();
export const destinationKey = Symbol('destination'); export const destination = DiBag.token(destinationKey).of<{ id: number }>();
export const base = DiBag.begin().add({ value: () => ({ id: 1, extra: true }) });
export const named = base.alias('copy', 'value');
export const bag = named.alias(destination, 'copy').end();
export const forward = DiBag.begin().alias('forward', target);
export const complete = forward.bind(target, () => ({ id: 1, extra: true })).alias(destination, target).end();
export const feature = DiBag.module().alias('external', target).exports(['external']);
export const emptyFeature = DiBag.module().alias('private', target).exports([]);
export const host = DiBag.begin().install(feature);
export const emptyHost = DiBag.begin().install(emptyFeature);
const copy = bag.resolve('copy'); const tokenValue = bag.resolve(destination); const declared = complete.resolve('forward');
export type Exact = [Assert<Equal<typeof copy, { id: number; extra: boolean }>>,
  Assert<Equal<typeof tokenValue, { id: number; extra: boolean }>>,
  Assert<Equal<typeof declared, { id: number }>>,
  Assert<Equal<ModuleRequires<typeof feature>, Readonly<{ [key]: { id: number } }>>>,
  Assert<Equal<ModuleRequires<typeof emptyFeature>, Readonly<{ [key]: { id: number } }>>>];
export const promisedKey = Symbol('promise'); export const promised = DiBag.token(promisedKey).of<Promise<number>>();
export const promiseBag = DiBag.begin().alias('promise', promised).bind(promised, DiBag.factory(() => Promise.resolve(1), { acquisition: 'raw' })).end();
const promise = promiseBag.resolve('promise');
export type PromiseExact = Assert<Equal<typeof promise, Promise<number>>>;
const aliasMethod: typeof base.alias = base.alias;
export const reflected = aliasMethod('other', 'value');
export const explicit = base.alias<'explicit', 'value'>('explicit', 'value');
export type ReflectedParameters = Parameters<typeof base.alias>;
export type ReflectedReturn = ReturnType<typeof base.alias>;
const root = DiBag.withLifetime(() => ({ id: 1 }), 'root');
const rootConsumer = DiBag.withLifetime(({ copy }: { copy: { id: number } }) => copy, 'root');
export const rootBag = DiBag.begin().add({ root }).alias('copy', 'root').add({ rootConsumer }).end();
rootBag.scope({ share: ['copy'] });
export const privateRoot = DiBag.module().add({ root }).alias('copy', 'root').exports(['copy']).rename('copy', 'renamed');
DiBag.begin().install(privateRoot).add({ rootConsumer: DiBag.withLifetime(({ renamed }: { renamed: { id: number } }) => renamed, 'root') }).end();
export const publicTarget = DiBag.module().add({ value: () => ({ id: 1 }) }).alias('copy', 'value').exports(['copy', 'value']).rename('value', 'renamed');
export const publicTargetHost = DiBag.begin().install(publicTarget);
const metadata = bag.inspect('copy').metadata;
const frames = bag.inspect('copy').acquisitions;
// @ts-expect-error alias inspection cannot promise target metadata keys
metadata.old;
// @ts-expect-error alias inspection cannot promise an empty canonical frame tuple
const exactFrames: readonly { metadata: readonly [] }[] = frames;

const scopedTarget = DiBag.begin().add({ value: () => 1, consumer: ({ copy }: { copy: number }) => copy }).alias('copy', 'value').end();
export const scopedShared = scopedTarget.scope(['value'], { value: DiBag.withLifetime(() => 2, 'root') }, { share: ['copy'] });
// Fresh grandchildren discard selected sharing and see their own root target.
scopedShared.scope(['consumer'], { consumer: DiBag.withLifetime(({ copy }: { copy: number }) => copy, 'root') });
scopedShared.fork(['consumer'], { consumer: DiBag.withLifetime(({ copy }: { copy: number }) => copy, 'root') });
const rootedTarget = DiBag.begin().add({ value: DiBag.withLifetime(() => 1, 'root'), consumer: ({ copy }: { copy: number }) => copy }).alias('copy', 'value').end();
export const rootShared = rootedTarget.scope(['value'], { value: () => 2 }, { share: ['copy'] });
rootShared.scope(['consumer'], { consumer: DiBag.withLifetime(({ copy }: { copy: number }) => copy, 'root') }, { share: ['copy'] });
export const sharedRootConsumer = rootedTarget.scope(['value', 'consumer'], {
  value: () => 2, consumer: DiBag.withLifetime(({ copy }: { copy: number }) => copy, 'root'),
}, { share: ['copy'] });
const transientOverride = rootedTarget.scope(['value'], { value: DiBag.withLifetime(() => 3, 'transient') }, { share: ['copy'] });
transientOverride.scope({ share: ['copy'] });

type IsAny<T> = 0 extends (1 & T) ? true : false;
export type ReflectedExact = [Assert<Equal<IsAny<ReturnType<typeof base.alias>>, false>>,
  Assert<Equal<ReturnType<typeof base.alias>, typeof base>>];
const moduleBase = DiBag.module().add({ value: () => 1 });
export type ModuleReflectedExact = [Assert<Equal<IsAny<ReturnType<typeof moduleBase.alias>>, false>>,
  Assert<Equal<ReturnType<typeof moduleBase.alias>, typeof moduleBase>>];
export function inferredAlias() { return base.alias('copy', 'value'); }
export function explicitAlias() { return base.alias<'copy', 'value'>('copy', 'value'); }
export type ConcreteUtilities = [Assert<Equal<ReturnType<typeof inferredAlias>, typeof named>>,
  Assert<Equal<ReturnType<typeof explicitAlias>, typeof named>>,
  Assert<Equal<IsAny<ReturnType<typeof inferredAlias>>, false>>];
declare const providerUnion: (() => 1) | (() => 2);
const unionOutput = DiBag.begin().add({ value: providerUnion }).alias('copy', 'value').end().resolve('copy');
export type UnionOutput = Assert<Equal<typeof unionOutput, 1 | 2>>;
