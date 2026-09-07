import { DiBag } from '../../src';
import { bag, complete, destination, forward, host, emptyHost, target, key, promiseBag, named, publicTargetHost, privateRoot } from './aliases';
import type { Assert, Equal } from './assert';
const copy = bag.resolve('copy'); const token = bag.resolve(destination); const declared = complete.resolve('forward'); const promise = promiseBag.resolve('promise');
export type Exact = [Assert<Equal<typeof copy, { id: number; extra: boolean }>>, Assert<Equal<typeof token, { id: number; extra: boolean }>>,
  Assert<Equal<typeof declared, { id: number }>>, Assert<Equal<typeof promise, Promise<number>>>];
forward.bind(target, () => ({ id: 1 })).end(); host.bind(target, () => ({ id: 1 })).end(); emptyHost.bind(target, () => ({ id: 1 })).end();
// @ts-expect-error emitted alias builder retains missing token requirement
forward.end();
// @ts-expect-error emitted module public view retains external token requirement
host.end();
// @ts-expect-error emitted exportless module retains external token requirement
emptyHost.end();
const wrong = DiBag.token(key).of<string>();
// @ts-expect-error emitted alias retains nominal target service
forward.bind(wrong, () => 'bad');
// @ts-expect-error named alias consumers retain their promised output after replacement
named.replace('value', () => ({ id: 1 }));
// @ts-expect-error exported target rename retains alias shape obligations
publicTargetHost.replace('renamed', () => 'wrong');
DiBag.begin().install(privateRoot).add({ root: DiBag.withLifetime(({ renamed }: { renamed: { id: number } }) => renamed, 'root') }).end();
import { rootShared, scopedShared, sharedRootConsumer } from './aliases';
rootShared.scope(['consumer'], { consumer: DiBag.withLifetime(({ copy }: { copy: number }) => copy, 'root') }, { share: ['copy'] });
scopedShared.scope(['consumer'], { consumer: DiBag.withLifetime(({ copy }: { copy: number }) => copy, 'root') });
scopedShared.fork(['consumer'], { consumer: DiBag.withLifetime(({ copy }: { copy: number }) => copy, 'root') });
// @ts-expect-error inferred selected alias retains the effective parent scoped policy
scopedShared.scope(['consumer'], { consumer: DiBag.withLifetime(({ copy }: { copy: number }) => copy, 'root') }, { share: ['copy'] });
// @ts-expect-error fresh scope discards alias sharing and returns to scoped child target
rootShared.scope(['consumer'], { consumer: DiBag.withLifetime(({ copy }: { copy: number }) => copy, 'root') });
// @ts-expect-error independent fork discards alias sharing and returns to scoped child target
rootShared.fork(['consumer'], { consumer: DiBag.withLifetime(({ copy }: { copy: number }) => copy, 'root') });
// @ts-expect-error retained parent root cannot justify the fork's own captive graph
sharedRootConsumer.fork();
