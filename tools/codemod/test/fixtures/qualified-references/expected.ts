import { DiBag, type DiBagServiceReadinessError } from 'di-bag';
import * as library from 'di-bag';

const builder = DiBag.createBuilder().withServices({ value: () => 1 });
declare const startupError: DiBagServiceReadinessError;
const errorBuilder = DiBag.createBuilder().withServices({ error: () => startupError });
export type NamespaceErrorReference = typeof library.DiBagServiceReadinessError;

export type BuildReference = typeof builder.buildContainer;
export type ReplacementReference = typeof builder.withReplacedService;
export type GenericReplacementReference = typeof errorBuilder.withReplacedService<'error', () => DiBagServiceReadinessError>;
export type AliasReference = typeof builder.alias;
export type ContributionReference = typeof builder.contribute;
export type RegistrationReference = typeof builder.register;

const fixtures = { feature: { builder } };
export type LongerReference = typeof fixtures.feature.builder.buildContainer;
export type TerminalOnlyReference = typeof fixtures.feature.builder.build.call;

class Registry {
  build(): unknown { return undefined; }
  register<D>(_services: D): Registry { return this; }
}

declare const choose: boolean;
const partial = choose ? builder : new Registry();
export type PartialReference = typeof partial.build;
export type PartialTraversalReference = typeof partial.build.call;

const nested = { owner: { partial } };
export type NestedPartialReference = typeof nested.owner.partial.register<{ error: () => DiBagStartupError }>;

const unrelated = new Registry();
export type UnrelatedReference = typeof unrelated.build;
