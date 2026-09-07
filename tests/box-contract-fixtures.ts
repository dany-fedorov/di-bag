import { readFileSync } from "node:fs";
import { resolve } from "node:path";

export const boxContractFixtures = ['acquisition-mode.ts', 'negative/acquisition-mode.ts', 'tokens.ts', 'negative/tokens.ts', 'negative/token-modules.ts', 'token-contracts.ts', 'negative/token-contracts.ts', 'box-adapters.ts', 'negative/box-adapters.ts', 'negative/provider-unions.ts', 'incremental.ts', 'negative/incremental.ts', 'builder-views.ts', 'negative/builder-views.ts', 'modern-inline.ts', 'negative/modern-inline.ts', 'real', 'replacement-supported.ts', 'negative/replacement-views.ts'];
export function boxContractSource(fixture: string): string {
      const assertions = `type Assert<T extends true> = T; type Equal<A, B> = (<T>() => T extends A ? 1 : 2) extends (<T>() => T extends B ? 1 : 2) ? true : false;`;
      return fixture === 'real' ? `
        import { DiBag, type ProviderOutput, type ProviderAcquisitionMetadata, type ValBoxFrame } from 'di-bag';
        import { fromSasBox } from 'di-bag/sas-box'; import { fromValBox, fromValBoxAsync } from 'di-bag/val-box';
        import { SasBox } from 'sas-box'; import { ValBox } from 'val-box'; ${assertions}
        const sync = fromSasBox(() => SasBox.fromValue(Promise.resolve(42)), { mode: 'sync' });
        const async = fromSasBox(() => SasBox.fromAsync(async () => 7), { mode: 'sync-first' });
        declare const unknown: SasBox.Unknown<Promise<number>>;
        const first = fromSasBox(() => unknown, { mode: 'sync-first' });
        const boxed = new ValBox.WithValue.WithMetadata(Promise.resolve(1), { owner: 'db' });
        const nested = fromValBox(() => ({ snapshot() { return {
          value: { present: true as const, value: boxed },
          metadata: { present: false as const }, alias: null,
        }; } }));
        const nestedValue = fromValBox(nested);
        const val = fromValBox(() => boxed); const awaited = fromValBoxAsync(async () => boxed);
        type Nested = [Assert<Equal<ProviderOutput<typeof nested>, typeof boxed>>,
          Assert<Equal<ProviderOutput<typeof nestedValue>, Promise<number>>>,
          Assert<Equal<ProviderAcquisitionMetadata<typeof nestedValue>, readonly [ValBoxFrame<never>, ValBoxFrame<{owner:string}>]>>];
        type Contracts = [Assert<Equal<ProviderOutput<typeof sync>, Promise<number>>>, Assert<Equal<ProviderOutput<typeof async>, Promise<number>>>,
          Assert<Equal<ProviderOutput<typeof first>, Promise<number>>>, Assert<Equal<ProviderOutput<typeof val>, Promise<number>>>,
          Assert<Equal<ProviderOutput<typeof awaited>, Promise<number>>>, Assert<Equal<ProviderAcquisitionMetadata<typeof val>, readonly [ValBoxFrame<{ owner: string }>]>>];
        const bag = DiBag.begin().add({ sync, async, first, val, awaited }).end(); void bag.close();
        // @ts-expect-error Async boxes have no sync route.
        fromSasBox(() => SasBox.fromAsync(async () => 7), { mode: 'sync' });
      ` : readFileSync(resolve(__dirname, 'types', fixture), 'utf8')
        .replace(/from '(?:\.\.\/)+src\/(provider|tokens|token-types|module-types)'/g, "from './node_modules/di-bag/dist/$1.js'")
        .replace(/import\('(?:\.\.\/)+src\/token-types'\)/g, "import('./node_modules/di-bag/dist/token-types.js')")
        .replace("import('../../src')", "import('di-bag')")
        .replace(/from '(?:\.\.\/)+src(\/[^']+)?'/g, (_match, subpath: string | undefined) => `from 'di-bag${subpath ?? ''}'`)
        .replace("import type { Assert, Equal } from './assert';", assertions);
}
