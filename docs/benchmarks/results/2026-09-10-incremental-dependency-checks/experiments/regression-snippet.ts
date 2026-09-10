// Retained token checks must preserve manual histories and generic empty keys.
export type RetainedTokenShortcutContracts = [
  Assert<Equal<Incremental<{ key: any; registration: ReadWider }, { [key]: Bound }>, Failure<typeof key>>>,
  Assert<Equal<Incremental<{ key: 'read'; registration: ReadWider | OpaqueRead }, { [key]: Bound }>, Failure<'opaque token contract' | typeof key>>>,
];
function bindFromNeverHistory<R extends Registration>(builder: Builder<{ key: never; registration: R }>) {
  return builder.bind(token, () => ({ value: 1 }));
}
