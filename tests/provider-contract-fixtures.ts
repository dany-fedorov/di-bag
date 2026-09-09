import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { replacementDiagnosticFixtures } from '../scripts/replacement-diagnostics.ts';

const baseProviderContractFixtures = [
  'final-adversarial-integration.ts', 'negative/final-adversarial-integration.ts',
  'plugins.ts', 'negative/plugins.ts', 'observers.ts', 'negative/observers.ts',
  'contributions.ts', 'negative/contributions.ts', 'aliases.ts', 'negative/aliases.ts',
  'dependency-references.ts', 'negative/dependency-references.ts',
  'composition-adapters.ts', 'negative/composition-adapters.ts',
  'selected-scopes.ts', 'negative/selected-scopes.ts', 'startup.ts', 'negative/startup.ts',
  'acquisition-mode.ts', 'negative/acquisition-mode.ts',
  'acquisition-metadata.ts', 'negative/acquisition-metadata.ts',
  'scopes.ts', 'negative/scopes.ts', 'lifetimes.ts', 'negative/lifetimes.ts',
  'tokens.ts', 'negative/tokens.ts', 'negative/token-modules.ts',
  'token-contracts.ts', 'negative/token-contracts.ts', 'negative/provider-unions.ts',
  'incremental.ts', 'negative/incremental.ts', 'incremental-modules.ts',
  'negative/incremental-modules.ts', 'builder-views.ts', 'negative/builder-views.ts',
  'modern-inline.ts', 'negative/modern-inline.ts', 'replacement-supported.ts',
  'negative/replacement-views.ts', 'replacement-context.ts', 'replacement-reflection.ts',
  'negative/replacement-reflection.ts',
];

export const providerContractFixtures = [...new Set([
  ...baseProviderContractFixtures,
  ...replacementDiagnosticFixtures,
])];

export function providerContractSource(fixture: string): string {
  const assertions = 'type Assert<T extends true> = T; type Equal<A, B> = (<T>() => T extends A ? 1 : 2) extends (<T>() => T extends B ? 1 : 2) ? true : false;';
  return readFileSync(resolve(__dirname, 'types', fixture), 'utf8')
    .replace(/from '(?:\.\.\/)+src\/(provider|tokens|token-types|module-types)'/g, "from './node_modules/di-bag/dist/$1.js'")
    .replace(/from '(?:\.\.\/)+src\/di-bag'/g, "from 'di-bag'")
    .replace(/import\('(?:\.\.\/)+src\/token-types'\)/g, "import('./node_modules/di-bag/dist/token-types.js')")
    .replace(/import\('(?:\.\.\/)+src'\)/g, "import('di-bag')")
    .replace(/from '(?:\.\.\/)+src(\/[^']+)?'/g, (_match, subpath: string | undefined) => `from 'di-bag${subpath ?? ''}'`)
    .replace("from '../modules/feature'", "from './replacement-module-feature.js'")
    .replace("import type { Assert, Equal } from './assert';", assertions);
}
