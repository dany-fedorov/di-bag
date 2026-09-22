import { DiBag, type Bag } from '../../../src';

const empty = DiBag.createBuilder();
const actual = empty.withServices({
  value: () => 1,
  read: ({ value }: { value: number }) => value.toFixed(),
});
const erasedAdd = empty.withServices<{ value: () => number; read: () => string }>;
const widenedAdd = empty.withServices<{
  value: () => number | string;
  read: (deps: { value: number }) => string;
}>;
// diagnostic: not assignable
const erased: ReturnType<typeof erasedAdd> = actual;
// diagnostic: not assignable
const widened: ReturnType<typeof widenedAdd> = actual;

// Already-rejecting neighborhood controls, not new bug claims.
// diagnostic: not assignable
const erasedBag: Bag<{ value: () => number | string; read: () => string }> = actual.buildContainer();
const emptyModule = DiBag.createBuilder();
const actualModule = emptyModule.withServices({
  value: () => 1,
  read: ({ value }: { value: number }) => value.toFixed(),
});
const erasedModuleAdd = emptyModule.withServices<{ value: () => number; read: () => string }>;
// diagnostic: not assignable
const erasedModule: ReturnType<typeof erasedModuleAdd> = actualModule;
