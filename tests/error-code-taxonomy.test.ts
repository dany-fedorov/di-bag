import { expect, test } from 'bun:test';
import { DiBag } from '../src';

// Each deliberately malformed call reaches one throw site whose code changes in phase 11.
type Diagnostic = Error & { code: string; details: Record<string, unknown> };
type Row = readonly [title: string, run: () => unknown, code: string, details: Record<string, unknown>];
const D = DiBag as any;

async function diagnosticOf(run: () => unknown): Promise<Diagnostic> {
  try { await run(); } catch (error) { return error as Diagnostic; }
  throw new Error('expected a throw or a rejection');
}

function check(rows: readonly Row[]): void {
  for (const [title, run, code, details] of rows) {
    test(title, async () => {
      const error = await diagnosticOf(run);
      expect(error.code).toBe(code);
      expect(error.details).toMatchObject(details);
      expect(error.message).toStartWith(`${code}: `);
    });
  }
}

const scoped = (factory: () => unknown) => D.providerWithLifetime({ provider: factory, lifetime: 'scoped:one-per-container' });
const builder = () => D.createBuilder().withServices({
  config: scoped(() => ({ region: 'eu' })),
  id: D.providerWithLifetime({ provider: () => 1, lifetime: 'transient:one-per-resolve' }),
});
const container = () => builder().buildContainer();

check([
  // 0.4.0: builder().register({ config: () => 1 })
  ['a service key registered twice', () => builder().withServices({ config: () => 1 }), 'DI_BAG_DUPLICATE_SERVICE_KEY', { operation: 'withServices', serviceKey: 'config' }],
  // 0.4.0: builder().alias('config', 'id')
  ['an alias key that is already registered', () => builder().withServiceAlias({ aliasKey: 'config', targetServiceKey: 'id' }), 'DI_BAG_DUPLICATE_SERVICE_KEY', { operation: 'withServiceAlias', serviceKey: 'config' }],
  // 0.4.0: builder().installModule(<a module that exports config>)
  ['a module that exports a key the host already has', () => builder().withInstalledModules([D.createBuilder().withServices({ config: () => 1 }).buildModule({ exportedServiceKeys: ['config'] })]), 'DI_BAG_DUPLICATE_SERVICE_KEY', { operation: 'withInstalledModules', serviceKey: 'config' }],
  // 0.4.0: <module exporting a and b>.renameExport('a', 'b')
  ['an export renamed onto another export', () => D.createBuilder().withServices({ a: () => 1, b: () => 2 }).buildModule({ exportedServiceKeys: ['a', 'b'] }).withRenamedExport({ currentExportKey: 'a', newExportKey: 'b' }), 'DI_BAG_DUPLICATE_SERVICE_KEY', { operation: 'withRenamedExport', serviceKey: 'b' }],
  // 0.4.0: DiBag.withMetadata(DiBag.withMetadata(f, { static: { owner: 1 } }), { static: { owner: 2 } })
  ['a registration metadata key set twice', () => D.providerWithRegistrationMetadata({ provider: D.providerWithRegistrationMetadata({ provider: () => 1, registrationMetadata: { owner: 1 } }), registrationMetadata: { owner: 2 } }), 'DI_BAG_DUPLICATE_METADATA_KEY', { operation: 'providerWithRegistrationMetadata', metadataKey: 'owner' }],
]);

void container;
