// Every "finding" comment below is asserted by tests/api-naming.test.ts; every "fine" comment must stay silent.
export type FixtureKind =
  | 'camelValue' // finding: value-casing
  | 'kebab-value' // fine
  | 'scoped:one-per-container' // fine: term:description
  | 'a message with spaces is prose'; // fine: not a value anyone passes
export type StartupThing = { readonly kind: 'cleanup-started' }; // findings: retired-word export, retired-word value
interface Hidden { readonly enabled: boolean } // reached through FixtureOptions.hidden; same subject as below, reported once
export interface FixtureOptions {
  readonly enabled: boolean; // finding: boolean-name
  readonly isEnabled: boolean; // fine
  readonly factoryReceivesContext?: true; // fine: the assertion verb may follow its subject
  readonly hidden: Hidden;
  readonly onEvent: (this: void, ctx: string) => void; // finding: abbreviation
}
class Builder {
  declare private readonly nominal: void; // fine: private
  /** @internal */
  internalThing(): void {} // fine: internal
  register(options: FixtureOptions): Builder; // finding: builder-method-prefix
  register(options: FixtureOptions, more: FixtureOptions): Builder;
  register(): Builder { return this; } // fine: the implementation of an overload set is not public
  withServices(): Builder { return this; } // fine
  buildContainer(): void {} // fine
  verifyGraphAtCompileTime(): void {} // fine
  readonly contribute: (deps: string) => Builder = () => this; // findings: builder-method-prefix, abbreviation
  constructor(readonly scopeId: symbol, plain: boolean) { void plain; } // finding: retired-word member scopeId; `plain` is fine
}
export type { Builder };
export const fixtureFacade: { readonly createBuilder: () => Builder } = {
  createBuilder: () => new Builder(Symbol('fixture'), true),
};
export function notExported(): string { return 'DI_BAG_startup_BAD'; } // findings: value-casing code, retired-word code
