import { DiBag } from '../../src';
import { bag, complete, destination, forward, host, emptyHost, target, key, promiseBag, named, publicTargetHost, privateRoot } from './aliases';
import type { Assert, Equal } from './assert';
const copy = bag.resolve('copy'); const token = bag.resolve(destination); const declared = complete.resolve('forward'); const promise = promiseBag.resolve('promise');
export type Exact = [Assert<Equal<typeof copy, { id: number; extra: boolean }>>, Assert<Equal<typeof token, { id: number; extra: boolean }>>,
  Assert<Equal<typeof declared, { id: number }>>, Assert<Equal<typeof promise, Promise<number>>>];
forward.register(target, () => ({ id: 1 })).build(); host.register(target, () => ({ id: 1 })).build(); emptyHost.register(target, () => ({ id: 1 })).build();
// @ts-expect-error emitted alias builder retains missing token requirement
forward.build();
// @ts-expect-error emitted module public view retains external token requirement
host.build();
// @ts-expect-error emitted exportless module retains external token requirement
emptyHost.build();
const wrong = DiBag.token(key).of<string>();
// @ts-expect-error emitted alias retains nominal target service
forward.register(wrong, () => 'bad');
// @ts-expect-error named alias consumers retain their promised output after replacement
named.replace('value', () => ({ id: 1 }));
// @ts-expect-error exported target rename retains alias shape obligations
publicTargetHost.replace('renamed', () => 'wrong');
DiBag.createBuilder().installModule(privateRoot).register({ root: DiBag.withLifetime(({ renamed }: { renamed: { id: number } }) => renamed, 'root') }).build();
import { rootShared, scopedShared, sharedRootConsumer } from './aliases';
rootShared.createScope(['consumer'], { consumer: DiBag.withLifetime(({ copy }: { copy: number }) => copy, 'root') }, { share: ['copy'] });
scopedShared.createScope(['consumer'], { consumer: DiBag.withLifetime(({ copy }: { copy: number }) => copy, 'root') });
scopedShared.fork(['consumer'], { consumer: DiBag.withLifetime(({ copy }: { copy: number }) => copy, 'root') });
// @ts-expect-error inferred selected alias retains the effective parent scoped policy
scopedShared.createScope(['consumer'], { consumer: DiBag.withLifetime(({ copy }: { copy: number }) => copy, 'root') }, { share: ['copy'] });
// @ts-expect-error fresh scope discards alias sharing and returns to scoped child target
rootShared.createScope(['consumer'], { consumer: DiBag.withLifetime(({ copy }: { copy: number }) => copy, 'root') });
// @ts-expect-error independent fork discards alias sharing and returns to scoped child target
rootShared.fork(['consumer'], { consumer: DiBag.withLifetime(({ copy }: { copy: number }) => copy, 'root') });
// @ts-expect-error retained parent root cannot justify the fork's own captive graph
sharedRootConsumer.fork();
