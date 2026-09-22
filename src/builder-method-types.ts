import type { AliasAdmission, AliasDestination, AliasDestinationAdmission, AliasEntries, AliasEntry, AliasSelection, AliasTarget } from './alias-types';
import type { RegisterTokenAdmission } from './contribution-types';
import type { InstalledModulesAdmission, InstalledModulesConstraints, InstalledModulesEntries } from './install-types';
import type { Module, ModuleOptions } from './module';
import type { CheckedConstraints, ExternalRequirements, ModuleExportAdmission, ModulePublicProviders, ModuleSealedConstraints, NeedConstraint } from './module-types';
import type { Factory, FactoryWithDisposal, Registration, Registrations } from './registration';
import type { SealAdmission, WithoutExportObligations } from './lifetime-types';
import type { BuilderReplacementRegistration, ReplacementAdmission, ReplacedEntries, ZeroDependencyAdmission } from './replacement-types';
import type { TokenBase, TokenKey } from './tokens';
import type { BindingOutput, TokenBinding, TokenTupleAdmission, SelectionKey } from './token-types';
import type {
  Entry,
  EntryKeys,
  ExportedServices,
  IncrementalChecked,
  Introduces,
  IntroducesKeys,
  NamedAdmission,
  OverrideRegistrations,
  RegistrationEntries,
  RegistrationsFromEntries,
  ReplacementKeyOf,
  ReplacementOutput,
  Selection,
  ServicesOf,
  ThenableAdmission,
} from './types';

type ReplacementFactory<Output> = (this: void) => Output;

/** The checked generic `withServices` callable exposed by a builder. */
export type BuilderWithServices<Entries extends Entry, Constraints extends NeedConstraint> = <Named extends { [Key in keyof Named]: Registration }>(
  providersByName: Named & Registrations & ([Named] extends [never]
    ? never
    : NamedAdmission<Named> & ThenableAdmission<Named> & IntroducesKeys<EntryKeys<Entries>, keyof Named> & IncrementalChecked<Entries, Named> &
      CheckedConstraints<Constraints, OverrideRegistrations<RegistrationsFromEntries<Entries>, Named>>),
) => import('./di-bag').Builder<Entries | RegistrationEntries<Named>, Constraints>;

/** The checked generic `withTokenService` callable exposed by a builder. */
export type BuilderWithTokenService<Entries extends Entry, Constraints extends NeedConstraint> = <TokenHandle extends TokenBase, Provider extends Registration>(
  options: {
    readonly token: TokenHandle & TokenTupleAdmission<readonly [TokenHandle]> & RegisterTokenAdmission<TokenHandle, Constraints> & IntroducesKeys<EntryKeys<Entries>, TokenKey<TokenHandle>>;
    readonly provider: Provider & Registration & BindingOutput<NoInfer<TokenHandle>, NoInfer<Provider>> & ThenableAdmission<Record<TokenKey<TokenHandle>, NoInfer<Provider>>> &
      IncrementalChecked<Entries, Record<TokenKey<TokenHandle>, TokenBinding<NoInfer<TokenHandle>, NoInfer<Provider>>>> &
      CheckedConstraints<Constraints, OverrideRegistrations<RegistrationsFromEntries<Entries>, Record<TokenKey<TokenHandle>, TokenBinding<NoInfer<TokenHandle>, NoInfer<Provider>>>>>;
  },
) => import('./di-bag').Builder<Entries | { key: TokenKey<TokenHandle>; registration: TokenBinding<TokenHandle, Provider> }, Constraints>;

/** The checked generic `withServiceAlias` callable exposed by a builder. */
export type BuilderWithServiceAlias<Entries extends Entry, Constraints extends NeedConstraint> = <const Destination extends AliasSelection, const Target extends AliasSelection>(
  options: {
    readonly aliasKey: Destination & AliasDestinationAdmission<Destination> & (unknown extends AliasAdmission<Destination> ? Introduces<RegistrationsFromEntries<Entries>, AliasEntries<RegistrationsFromEntries<Entries>, Destination, Target>> : AliasAdmission<Destination>);
    readonly targetServiceKey: Target & AliasAdmission<Target> & (unknown extends AliasAdmission<Target>
      ? AliasTarget<RegistrationsFromEntries<Entries>, Constraints, Target> & AliasDestination<RegistrationsFromEntries<Entries>, NoInfer<Destination>, Target> : unknown) &
      (unknown extends AliasAdmission<Destination> & AliasAdmission<Target>
        ? IncrementalChecked<Entries, AliasEntries<RegistrationsFromEntries<Entries>, NoInfer<Destination>, NoInfer<Target>>> & CheckedConstraints<Constraints, OverrideRegistrations<RegistrationsFromEntries<Entries>, AliasEntries<RegistrationsFromEntries<Entries>, NoInfer<Destination>, NoInfer<Target>>>> : unknown);
  },
  ...invalid: [Destination] extends [never] ? [never] : [Target] extends [never] ? [never] : []
) => import('./di-bag').Builder<Entries | AliasEntry<RegistrationsFromEntries<Entries>, Destination, Target>, Constraints>;

/** The checked overloads of `withReplacedService` exposed by a builder. */
export interface BuilderWithReplacedService<Entries extends Entry, Constraints extends NeedConstraint> {
  <const Key extends string, Provider extends (ReplacementFactory<ReplacementOutput<NoInfer<RegistrationsFromEntries<Entries>>, Key, Constraints>>) | FactoryWithDisposal<ReplacementFactory<ReplacementOutput<NoInfer<RegistrationsFromEntries<Entries>>, Key, Constraints>>>>(
    options: {
      readonly serviceKey: Key & ReplacementKeyOf<EntryKeys<Entries>, Key>;
      readonly provider: Provider & (Factory | FactoryWithDisposal<Factory>) & ZeroDependencyAdmission<NoInfer<Provider>> &
        CheckedConstraints<Constraints, OverrideRegistrations<RegistrationsFromEntries<Entries>, Record<Key, NoInfer<Provider>>>>;
    },
  ): import('./di-bag').Builder<Exclude<Entries, { key: Key }> | { key: Key; registration: Provider }, WithoutExportObligations<Constraints, Key>>;
  <const Key extends string | TokenBase, Provider extends Registration>(
    options: {
      readonly serviceKey: Key & NoInfer<ReplacementAdmission<RegistrationsFromEntries<Entries>, Constraints, Key>>;
      readonly provider: Provider & Registration & BuilderReplacementRegistration<Entries, Constraints, NoInfer<Key>, Provider>;
    },
  ): import('./di-bag').Builder<ReplacedEntries<Entries, Key, Provider>, WithoutExportObligations<Constraints, SelectionKey<Key>>>;
}

/** The checked expand-phase overloads of `buildModule` exposed by a builder. */
export interface BuilderBuildModule<Entries extends Entry, Constraints extends NeedConstraint> {
  <const Keys extends readonly unknown[]>(
    options: ModuleOptions & {
      readonly exportedServiceKeys: Keys & Selection<RegistrationsFromEntries<Entries>, Constraints, Keys, 'buildModule'> & ModuleExportAdmission<Keys> & SealAdmission<RegistrationsFromEntries<Entries>, Extract<SelectionKey<Keys[number]>, keyof RegistrationsFromEntries<Entries>>, Constraints>;
    },
  ): Module<
    ExportedServices<ServicesOf<RegistrationsFromEntries<Entries>>, Extract<SelectionKey<Keys[number]>, keyof RegistrationsFromEntries<Entries>>>,
    ExternalRequirements<ModuleSealedConstraints<Entries, Constraints, Extract<SelectionKey<Keys[number]>, keyof RegistrationsFromEntries<Entries>>>>,
    ModuleSealedConstraints<Entries, Constraints, Extract<SelectionKey<Keys[number]>, keyof RegistrationsFromEntries<Entries>>>,
    ModulePublicProviders<RegistrationsFromEntries<Entries>, Extract<SelectionKey<Keys[number]>, keyof RegistrationsFromEntries<Entries>>>
  >;
  /** @deprecated The 0.4.0 form; the contract step of phase 5 removes it. */
  <const Keys extends readonly unknown[]>(
    keys: Keys & Selection<RegistrationsFromEntries<Entries>, Constraints, Keys, 'buildModule'> & ModuleExportAdmission<Keys> & SealAdmission<RegistrationsFromEntries<Entries>, Extract<SelectionKey<Keys[number]>, keyof RegistrationsFromEntries<Entries>>, Constraints>,
    options?: ModuleOptions,
  ): Module<
    ExportedServices<ServicesOf<RegistrationsFromEntries<Entries>>, Extract<SelectionKey<Keys[number]>, keyof RegistrationsFromEntries<Entries>>>,
    ExternalRequirements<ModuleSealedConstraints<Entries, Constraints, Extract<SelectionKey<Keys[number]>, keyof RegistrationsFromEntries<Entries>>>>,
    ModuleSealedConstraints<Entries, Constraints, Extract<SelectionKey<Keys[number]>, keyof RegistrationsFromEntries<Entries>>>,
    ModulePublicProviders<RegistrationsFromEntries<Entries>, Extract<SelectionKey<Keys[number]>, keyof RegistrationsFromEntries<Entries>>>
  >;
}

/** The checked generic `withInstalledModules` callable exposed by a builder. */
export type BuilderWithInstalledModules<Entries extends Entry, Constraints extends NeedConstraint> = <const Modules extends readonly unknown[]>(
  modules: Modules & InstalledModulesAdmission<Entries, Constraints, Modules>,
) => import('./di-bag').Builder<InstalledModulesEntries<Entries, Constraints, Modules>, InstalledModulesConstraints<Entries, Constraints, Modules>>;
