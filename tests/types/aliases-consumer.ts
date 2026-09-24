import { DiBag } from '../../src';
import { bag, complete, destination, forward, host, emptyHost, target, key, promiseBag, named, publicTargetHost, privateRoot } from './aliases';
import type { Assert, Equal } from './assert';
const copy = bag.resolve('copy'); const token = bag.resolve(destination); const declared = complete.resolve('forward'); const promise = promiseBag.resolve('promise');
export type Exact = [Assert<Equal<typeof copy, { id: number; extra: boolean }>>, Assert<Equal<typeof token, { id: number; extra: boolean }>>,
  Assert<Equal<typeof declared, { id: number }>>, Assert<Equal<typeof promise, Promise<number>>>];
forward.withTokenService(target, () => ({ id: 1 })).buildContainer(); host.withTokenService(target, () => ({ id: 1 })).buildContainer(); emptyHost.withTokenService(target, () => ({ id: 1 })).buildContainer();
// @ts-expect-error emitted alias builder retains missing token requirement
forward.buildContainer();
// @ts-expect-error emitted module public view retains external token requirement
host.buildContainer();
// @ts-expect-error emitted exportless module retains external token requirement
emptyHost.buildContainer();
const wrong = DiBag.createToken(key).forService<string>();
// @ts-expect-error emitted alias retains nominal target service
forward.withTokenService(wrong, () => 'bad');
// @ts-expect-error named alias consumers retain their promised output after replacement
named.withReplacedService('value', () => ({ id: 1 }));
// @ts-expect-error exported target rename retains alias shape obligations
publicTargetHost.withReplacedService('renamed', () => 'wrong');
DiBag.createBuilder().withInstalledModules([privateRoot]).withServices({ root: DiBag.providerWithLifetime({ provider: ({ renamed }: { renamed: { id: number } }) => renamed, lifetime: 'singleton:one-per-container-tree' }) }).buildContainer();
import { rootShared, scopedShared, scopedTarget, sharedRootConsumer } from './aliases';
rootShared.createChildContainer(['consumer'], { consumer: DiBag.providerWithLifetime({ provider: ({ copy }: { copy: number }) => copy, lifetime: 'singleton:one-per-container-tree' }) }, { sharedParentServiceKeys: ['copy'] });
scopedShared.createChildContainer(['consumer'], { consumer: DiBag.providerWithLifetime({ provider: ({ copy }: { copy: number }) => copy, lifetime: 'singleton:one-per-container-tree' }) });
scopedShared.createIndependentContainer(['consumer'], { consumer: DiBag.providerWithLifetime({ provider: ({ copy }: { copy: number }) => copy, lifetime: 'singleton:one-per-container-tree' }) });
// @ts-expect-error inferred selected alias retains the effective parent scoped policy
scopedShared.createChildContainer(['consumer'], { consumer: DiBag.providerWithLifetime({ provider: ({ copy }: { copy: number }) => copy, lifetime: 'singleton:one-per-container-tree' }) }, { sharedParentServiceKeys: ['copy'] });
// @ts-expect-error fresh child cannot capture the scoped alias target
scopedTarget.createChildContainer(['consumer'], { consumer: DiBag.providerWithLifetime({ provider: ({ copy }: { copy: number }) => copy, lifetime: 'singleton:one-per-container-tree' }) });
// @ts-expect-error independent fork cannot capture the scoped alias target
scopedTarget.createIndependentContainer(['consumer'], { consumer: DiBag.providerWithLifetime({ provider: ({ copy }: { copy: number }) => copy, lifetime: 'singleton:one-per-container-tree' }) });
sharedRootConsumer.createIndependentContainer();
