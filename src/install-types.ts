import type { Module } from './module';
import type { IncrementalConstraints, NeedConstraint } from './module-types';
import type { Registrations } from './registration';
import type { Entry, EntryKeys, IncrementalChecked, IntroducesKeys, RegistrationEntries, RegistrationsFromEntries, Unsatisfied } from './types';

type NotAModule = Unsatisfied<'withInstalledModules requires a finite tuple of genuine modules', {}>;

// Tail-recursive, so a long list is evaluated iteratively. The running entries, constraints and
// checked elements are separate type arguments because type arguments are computed at every step;
// members of an object type are computed lazily and would nest one level per module.
// Each module is checked against the builder plus the modules before it, exactly as separate
// installs would be, and each check is intersected into ITS element, so the compiler reports a
// failure on that element of the array literal.
type InstallFold<Modules extends readonly unknown[], Entries extends Entry, Constraints extends NeedConstraint, Checked extends readonly unknown[]> =
  Modules extends readonly [infer Head, ...infer Rest]
    ? Head extends Module<infer _P, infer _R, infer MC extends NeedConstraint, infer D extends Registrations>
      ? InstallFold<Rest, Entries | RegistrationEntries<D>, Constraints | MC, readonly [
          ...Checked,
          Head & IntroducesKeys<EntryKeys<Entries>, keyof D> &
            IncrementalChecked<Entries, D> &
            IncrementalConstraints<Constraints, MC, RegistrationsFromEntries<Entries>, D>,
        ]>
      : InstallFold<Rest, Entries, Constraints, readonly [...Checked, NotAModule]>
    : { readonly entries: Entries; readonly constraints: Constraints; readonly checked: Checked };

type Installed<Entries extends Entry, Constraints extends NeedConstraint, Modules extends readonly unknown[]> =
  InstallFold<Modules, Entries, Constraints, readonly []>;

/** The element-wise admission of a module list: element `i` carries the checks of module `i`. */
export type InstalledModulesAdmission<Entries extends Entry, Constraints extends NeedConstraint, Modules extends readonly unknown[]> =
  number extends Modules['length'] ? NotAModule : Installed<Entries, Constraints, Modules>['checked'];
/** The builder entries after every module of the list is installed. */
export type InstalledModulesEntries<Entries extends Entry, Constraints extends NeedConstraint, Modules extends readonly unknown[]> =
  Installed<Entries, Constraints, Modules>['entries'];
/** The retained constraints after every module of the list is installed. */
export type InstalledModulesConstraints<Entries extends Entry, Constraints extends NeedConstraint, Modules extends readonly unknown[]> =
  Installed<Entries, Constraints, Modules>['constraints'];
