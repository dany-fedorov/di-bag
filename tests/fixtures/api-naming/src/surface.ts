// Every "finding" comment below is asserted by tests/api-naming.test.ts; every "fine" comment must stay silent.
export type FixtureKind =
  | 'camelValue' // finding: value-casing
  | 'kebab-value' // fine
  | 'scoped:one-per-container' // fine: term:description
  | 'a message with spaces is prose'; // fine: not a value anyone passes
export type StartupThing = { readonly kind: 'cleanup\u002dstarted' }; // findings: retired-word export, retired-word value
type Wrapper<T> = { readonly wrapped: T };
type OperationLabel<Operation extends string = 'fork'> = Operation;
type SeeErrors<Family extends string> = `; see errors#${Family}`;
export type ScannerReferences<T extends { readonly camelKey: unknown }> = {
  readonly operation: OperationLabel<'createScope'>;
  readonly omitted: Exclude<keyof T, 'allowScopedDependencies'>;
  readonly indexed: T['camelKey'];
  readonly diagnostic: SeeErrors<'singleton-captures-scoped'>;
  readonly isCompared: 'allowScopedDependencies' extends keyof T ? true : false;
};
export type StandardKeyReferences<T extends { readonly camelKey: unknown; readonly anotherKey: unknown }> = {
  readonly picked: Pick<T, 'camelKey'>;
  readonly omitted: Omit<T, 'anotherKey'>;
  readonly properPayload: Wrapper<'properPayloadValue'>; // finding: value-casing
};
export type NestedValues<T> = T extends string
  ? Wrapper<'nestedGenericValue'> // finding: value-casing
  : { readonly [K in 'mappedKey']: Promise<'cleanup-finished'> }; // finding: retired-word value; mapped key is an identifier
export class FixtureDiagnosticError extends Error {
  declare readonly details: Readonly<{
    readonly operation: 'methodReference'; // fine: a diagnostic structural reference to the method
    readonly adjacent: 'neighboringDiagnosticValue'; // finding: value-casing
  }>;
}
export type UnrelatedOperationPayload = {
  readonly operation: 'ordinaryPayloadValue'; // finding: an ordinary payload is still an enum-like value
};
interface Hidden { readonly enabled: boolean } // reached through FixtureOptions.hidden; same subject as below, reported once
export interface FixtureOptions {
  readonly enabled: boolean; // finding: boolean-name
  readonly isEnabled: boolean; // fine
  readonly factoryReceivesContext?: true; // fine: the assertion verb may follow its subject
  readonly hidden: Hidden;
  readonly onEvent: (this: void, ctx: string) => void; // finding: abbreviation
  enabledNow(): boolean; // finding: boolean-name
  isReady(): boolean; // fine
  get available(): boolean; // finding: boolean-name
  get hasCapacity(): boolean; // fine
  result(): Promise<'resultValue'>; // finding: value-casing
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
  constructor(readonly sc\u006fpeId: symbol, plain: boolean) { void plain; } // finding: retired-word member; `plain` is fine
}
export type { Builder };
export const fixtureFacade: { readonly createBuilder: () => Builder } = {
  createBuilder: () => new Builder(Symbol('fixture'), true),
};
export function notExported(): string { return 'DI_BAG_startup_BAD'; } // findings: value-casing code, retired-word code
