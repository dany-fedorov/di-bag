import { DiBag } from '../../../src';

const provider = DiBag.createProvider(() => 1);

const unknownOptions = {
  provider,
  lifetime: 'singleton:one-per-container-tree',
  extra: true,
} as const;
// diagnostic: providerWithLifetime allowsScopedDependencies requires singleton lifetime and a boolean value
DiBag.providerWithLifetime(unknownOptions);

const undefinedOptions = {
  provider,
  lifetime: 'singleton:one-per-container-tree',
  allowsScopedDependencies: undefined,
} as const;
// diagnostic: Type 'undefined' is not assignable to type 'boolean'
DiBag.providerWithLifetime(undefinedOptions);

declare const lifetime: 'singleton:one-per-container-tree' | 'scoped:one-per-container';
DiBag.providerWithLifetime({ provider,
  // diagnostic: lifetime requires an individually known policy literal
  lifetime,
});

declare const optionalScopedOptions: {
  readonly provider: typeof provider;
  readonly lifetime: 'scoped:one-per-container';
  readonly allowsScopedDependencies?: boolean;
};
// diagnostic: providerWithLifetime allowsScopedDependencies requires singleton lifetime and a boolean value
DiBag.providerWithLifetime(optionalScopedOptions);

declare const indexedOptions: {
  readonly provider: typeof provider;
  readonly lifetime: 'singleton:one-per-container-tree';
} & Readonly<Record<string, unknown>>;
// diagnostic: providerWithLifetime allowsScopedDependencies requires singleton lifetime and a boolean value
DiBag.providerWithLifetime(indexedOptions);

const extraSymbol = Symbol('extra');
DiBag.providerWithLifetime({ provider, lifetime: 'singleton:one-per-container-tree',
  // diagnostic: providerWithLifetime allowsScopedDependencies requires singleton lifetime and a boolean value
  [extraSymbol]: true,
});
