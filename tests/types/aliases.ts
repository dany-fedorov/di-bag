import { DiBag, type ModuleRequiredServices, type Builder } from '../../src';
import type { Assert, Equal } from './assert';
export const key = Symbol('source'); export const target = DiBag.createToken(key).forService<{ id: number }>();
export const destinationKey = Symbol('destination'); export const destination = DiBag.createToken(destinationKey).forService<{ id: number }>();
export const base = DiBag.createBuilder().withServices({ value: () => ({ id: 1, extra: true }) });
export const named = base.withServiceAlias({ aliasKey: 'copy', targetServiceKey: 'value' });
export const bag = named.withServiceAlias({ aliasKey: destination, targetServiceKey: 'copy' }).buildContainer();
export const forward = DiBag.createBuilder().withServiceAlias({ aliasKey: 'forward', targetServiceKey: target });
export const complete = forward.withTokenService(target, () => ({ id: 1, extra: true })).withServiceAlias({ aliasKey: destination, targetServiceKey: target }).buildContainer();
export const feature = DiBag.createBuilder().withServiceAlias({ aliasKey: 'external', targetServiceKey: target }).buildModule({ exportedServiceKeys: ['external'] });
export const emptyFeature = DiBag.createBuilder().withServiceAlias({ aliasKey: 'private', targetServiceKey: target }).buildModule({ exportedServiceKeys: [] });
export const host = DiBag.createBuilder().withInstalledModules([feature]);
export const emptyHost = DiBag.createBuilder().withInstalledModules([emptyFeature]);
const copy = bag.resolve('copy'); const tokenValue = bag.resolve(destination); const declared = complete.resolve('forward');
export type Exact = [Assert<Equal<typeof copy, { id: number; extra: boolean }>>,
  Assert<Equal<typeof tokenValue, { id: number; extra: boolean }>>,
  Assert<Equal<typeof declared, { id: number }>>,
  Assert<Equal<ModuleRequiredServices<typeof feature>, Readonly<{ [key]: { id: number } }>>>,
  Assert<Equal<ModuleRequiredServices<typeof emptyFeature>, Readonly<{ [key]: { id: number } }>>>];
export const promisedKey = Symbol('promise'); export const promised = DiBag.createToken(promisedKey).forService<Promise<number>>();
export const promiseBag = DiBag.createBuilder().withServiceAlias({ aliasKey: 'promise', targetServiceKey: promised }).withTokenService(promised, DiBag.createProvider(() => Promise.resolve(1), { factoryReturnKind: 'uninspected' })).buildContainer();
const promise = promiseBag.resolve('promise');
export type PromiseExact = Assert<Equal<typeof promise, Promise<number>>>;
const aliasMethod: typeof base.withServiceAlias = base.withServiceAlias;
export const reflected = aliasMethod({ aliasKey: 'other', targetServiceKey: 'value' });
export const explicit = base.withServiceAlias<'explicit', 'value'>({ aliasKey: 'explicit', targetServiceKey: 'value' });
export type ReflectedParameters = Parameters<typeof base.withServiceAlias>;
export type ReflectedReturn = ReturnType<typeof base.withServiceAlias>;
const root = DiBag.providerWithLifetime({ provider: () => ({ id: 1 }), lifetime: 'singleton:one-per-container-tree' });
const rootConsumer = DiBag.providerWithLifetime({ provider: ({ copy }: { copy: { id: number } }) => copy, lifetime: 'singleton:one-per-container-tree' });
export const rootBag = DiBag.createBuilder().withServices({ root }).withServiceAlias({ aliasKey: 'copy', targetServiceKey: 'root' }).withServices({ rootConsumer }).buildContainer();
rootBag.createChildContainer({ sharedParentServiceKeys: ['copy'] });
export const privateRoot = DiBag.createBuilder().withServices({ root }).withServiceAlias({ aliasKey: 'copy', targetServiceKey: 'root' }).buildModule({ exportedServiceKeys: ['copy'] }).withRenamedExport({ currentExportKey: 'copy', newExportKey: 'renamed' });
DiBag.createBuilder().withInstalledModules([privateRoot]).withServices({ rootConsumer: DiBag.providerWithLifetime({ provider: ({ renamed }: { renamed: { id: number } }) => renamed, lifetime: 'singleton:one-per-container-tree' }) }).buildContainer();
export const publicTarget = DiBag.createBuilder().withServices({ value: () => ({ id: 1 }) }).withServiceAlias({ aliasKey: 'copy', targetServiceKey: 'value' }).buildModule({ exportedServiceKeys: ['copy', 'value'] }).withRenamedExport({ currentExportKey: 'value', newExportKey: 'renamed' });
export const publicTargetHost = DiBag.createBuilder().withInstalledModules([publicTarget]);
const metadata = bag.serviceSnapshot('copy').registrationMetadata;
const frames = bag.serviceSnapshot('copy').acquisitions;
// @ts-expect-error alias inspection cannot promise target metadata keys
metadata.old;
// @ts-expect-error alias inspection cannot promise an empty canonical frame tuple
const exactFrames: readonly { metadata: readonly [] }[] = frames;

export const scopedTarget = DiBag.createBuilder().withServices({ value: () => 1, consumer: ({ copy }: { copy: number }) => copy }).withServiceAlias({ aliasKey: 'copy', targetServiceKey: 'value' }).buildContainer();
export const scopedShared = scopedTarget.createChildContainer(['value'], { value: DiBag.providerWithLifetime({ provider: () => 2, lifetime: 'singleton:one-per-container-tree' }) }, { sharedParentServiceKeys: ['copy'] });
// Fresh grandchildren discard selected sharing and see their own root target.
scopedShared.createChildContainer(['consumer'], { consumer: DiBag.providerWithLifetime({ provider: ({ copy }: { copy: number }) => copy, lifetime: 'singleton:one-per-container-tree' }) });
scopedShared.createIndependentContainer(['consumer'], { consumer: DiBag.providerWithLifetime({ provider: ({ copy }: { copy: number }) => copy, lifetime: 'singleton:one-per-container-tree' }) });
const rootedTarget = DiBag.createBuilder().withServices({ value: DiBag.providerWithLifetime({ provider: () => 1, lifetime: 'singleton:one-per-container-tree' }), consumer: ({ copy }: { copy: number }) => copy }).withServiceAlias({ aliasKey: 'copy', targetServiceKey: 'value' }).buildContainer();
export const rootShared = rootedTarget.createChildContainer({ sharedParentServiceKeys: ['copy'] });
rootShared.createChildContainer(['consumer'], { consumer: DiBag.providerWithLifetime({ provider: ({ copy }: { copy: number }) => copy, lifetime: 'singleton:one-per-container-tree' }) }, { sharedParentServiceKeys: ['copy'] });
export const sharedRootConsumer = rootedTarget.createChildContainer(['consumer'], {
  consumer: DiBag.providerWithLifetime({ provider: ({ copy }: { copy: number }) => copy, lifetime: 'singleton:one-per-container-tree' }),
}, { sharedParentServiceKeys: ['copy'] });
const transientOverride = scopedTarget.createChildContainer(['value'], { value: DiBag.providerWithLifetime({ provider: () => 3, lifetime: 'transient:one-per-resolve' }) }, { sharedParentServiceKeys: ['copy'] });
transientOverride.createChildContainer({ sharedParentServiceKeys: ['copy'] });

type IsAny<T> = 0 extends (1 & T) ? true : false;
export type ReflectedExact = [Assert<Equal<IsAny<ReturnType<typeof base.withServiceAlias>>, false>>,
  Assert<Equal<ReturnType<typeof base.withServiceAlias>, typeof base>>];
const moduleBase = DiBag.createBuilder().withServices({ value: () => 1 });
export type ModuleReflectedExact = [Assert<Equal<IsAny<ReturnType<typeof moduleBase.withServiceAlias>>, false>>,
  Assert<Equal<ReturnType<typeof moduleBase.withServiceAlias>, typeof moduleBase>>];
export function inferredAlias() { return base.withServiceAlias({ aliasKey: 'copy', targetServiceKey: 'value' }); }
export function explicitAlias() { return base.withServiceAlias<'copy', 'value'>({ aliasKey: 'copy', targetServiceKey: 'value' }); }
export type ConcreteUtilities = [Assert<Equal<ReturnType<typeof inferredAlias>, typeof named>>,
  Assert<Equal<ReturnType<typeof explicitAlias>, typeof named>>,
  Assert<Equal<IsAny<ReturnType<typeof inferredAlias>>, false>>];
declare const providerUnion: (() => 1) | (() => 2);
const unionOutput = DiBag.createBuilder().withServices({ value: providerUnion }).withServiceAlias({ aliasKey: 'copy', targetServiceKey: 'value' }).buildContainer().resolve('copy');
export type UnionOutput = Assert<Equal<typeof unionOutput, 1 | 2>>;
