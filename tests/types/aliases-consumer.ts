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
DiBag.createBuilder().withInstalledModules([privateRoot]).withServices({ root: DiBag.withLifetime(({ renamed }: { renamed: { id: number } }) => renamed, 'root') }).buildContainer();
import { rootShared, scopedShared, sharedRootConsumer } from './aliases';
rootShared.createChildContainer(['consumer'], { consumer: DiBag.withLifetime(({ copy }: { copy: number }) => copy, 'root') }, { sharedParentServiceKeys: ['copy'] });
scopedShared.createChildContainer(['consumer'], { consumer: DiBag.withLifetime(({ copy }: { copy: number }) => copy, 'root') });
scopedShared.createIndependentContainer(['consumer'], { consumer: DiBag.withLifetime(({ copy }: { copy: number }) => copy, 'root') });
// @ts-expect-error inferred selected alias retains the effective parent scoped policy
scopedShared.createChildContainer(['consumer'], { consumer: DiBag.withLifetime(({ copy }: { copy: number }) => copy, 'root') }, { sharedParentServiceKeys: ['copy'] });
// @ts-expect-error fresh scope discards alias sharing and returns to scoped child target
rootShared.createChildContainer(['consumer'], { consumer: DiBag.withLifetime(({ copy }: { copy: number }) => copy, 'root') });
// @ts-expect-error independent fork discards alias sharing and returns to scoped child target
rootShared.createIndependentContainer(['consumer'], { consumer: DiBag.withLifetime(({ copy }: { copy: number }) => copy, 'root') });
// @ts-expect-error retained parent root cannot justify the fork's own captive graph
sharedRootConsumer.createIndependentContainer();
