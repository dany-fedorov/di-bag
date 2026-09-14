import type { Builder } from './di-bag';
import type { CheckedLifetimes } from './lifetime-types';
import type { CheckedConstraints, CompleteConstraints, NeedConstraint } from './module-types';
import type { CheckDependencyCompatibility, CheckDependencyCompleteness, ConsumerReport, Entry, RegistrationsFromEntries } from './types';

type ReportOf<Check> = unknown extends Check ? never : Check;
type Reports<E extends Entry, C extends NeedConstraint> =
  | ReportOf<ConsumerReport<CheckDependencyCompatibility<RegistrationsFromEntries<E>>>>
  | ReportOf<CheckDependencyCompleteness<RegistrationsFromEntries<E>>>
  | ReportOf<ConsumerReport<CheckedConstraints<C, RegistrationsFromEntries<E>>>>
  | ReportOf<CompleteConstraints<C, RegistrationsFromEntries<E>>>
  | ReportOf<CheckedLifetimes<RegistrationsFromEntries<E>, C>>;

/**
 * The compile-time verdict for a builder: `void` when `build()` would be accepted,
 * otherwise the same failure `build()` reports, including its details.
 * Read it through `builder.verifyGraph() satisfies void;` or as `CompositionReport<typeof builder>`.
 * @see https://dany-fedorov.github.io/di-bag/guides/tutorial.html#read-compile-time-rejections
 */
export type CompositionReport<B> = B extends Builder<infer E, infer C>
  ? [Reports<E, C>] extends [never] ? void : Reports<E, C>
  : never;
