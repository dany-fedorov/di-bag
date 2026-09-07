import { DiBag, type Bag } from '../../../src';

const empty = DiBag.begin();
const actual = empty.add({
  value: () => 1,
  read: ({ value }: { value: number }) => value.toFixed(),
});
const erasedAdd = empty.add<{ value: () => number; read: () => string }>;
const widenedAdd = empty.add<{
  value: () => number | string;
  read: (deps: { value: number }) => string;
}>;
// diagnostic: not assignable
const erased: ReturnType<typeof erasedAdd> = actual;
// diagnostic: not assignable
const widened: ReturnType<typeof widenedAdd> = actual;

// Already-rejecting neighborhood controls, not new bug claims.
// diagnostic: not assignable
const erasedBag: Bag<{ value: () => number | string; read: () => string }> = actual.end();
const emptyModule = DiBag.module();
const actualModule = emptyModule.add({
  value: () => 1,
  read: ({ value }: { value: number }) => value.toFixed(),
});
const erasedModuleAdd = emptyModule.add<{ value: () => number; read: () => string }>;
// diagnostic: not assignable
const erasedModule: ReturnType<typeof erasedModuleAdd> = actualModule;
