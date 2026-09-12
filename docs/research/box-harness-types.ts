// Compile-only probe: do not execute. See 2026-09-12-box-harness-evidence.md for setup and commands.
import { SasBox } from '../../../sas-box/src/index';
import { ValBox } from '../../../val-box/src/index';

type SyncProvider<T> = { sync: () => T; async: () => Promise<Awaited<T>> };
type AsyncProvider<T> = { sync?: undefined; async: () => Promise<Awaited<T>> };
declare const boxedAsync: SasBox.Async<boolean>;
declare const plainAsync: AsyncProvider<boolean>;
declare function boxedGuard(provider: SasBox.Sync<boolean>): boolean;
declare function plainGuard(provider: SyncProvider<boolean>): boolean;
// @ts-expect-error Both representations reject async-only strict consumers.
boxedGuard(boxedAsync);
// @ts-expect-error Same boundary without the library.
plainGuard(plainAsync);
const promised = SasBox.fromSync(() => Promise.resolve(true));
// @ts-expect-error Synchronous acquisition of a Promise is not a boolean.
boxedGuard(promised);
declare const unknownBox: SasBox.Unknown<boolean>;
if (unknownBox.hasSync()) {
  // @ts-expect-error hasSync() is boolean, not a type predicate.
  unknownBox.sync();
}
const definite: boolean = unknownBox.assertHasSync().sync();
// @ts-expect-error Box callback API accepts zero arguments.
unknownBox.async({ query: 'refunds' });
declare const value: ValBox.Unknown<number, string>;
value.assertHasValue();
// @ts-expect-error Runtime assertion returns this; it does not refine getValue.
const stillOptional: number = value.getValue();
const required: number = value.convert({ hasValue: true }).getValue();
type Presence<T> = { readonly present: false } | { readonly present: true; readonly value: T };
declare const plain: Presence<number>;
// @ts-expect-error Plain union forces the same presence check as snapshot.
const uncheckedPlain = plain.value;
const snapshot = value.snapshot();
// @ts-expect-error Snapshot also requires presence discrimination.
const uncheckedBox = snapshot.value.value;
if (plain.present) { const payload: number = plain.value; void payload; }
if (snapshot.value.present) { const payload: number = snapshot.value.value; void payload; }
void definite; void stillOptional; void required; void uncheckedPlain; void uncheckedBox;
