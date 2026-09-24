import { DiBag } from '../../src';

const exactKey: unique symbol = Symbol('exact');
export const exactToken = DiBag.createToken(exactKey).forService<{ readonly id: 'token'; read(): number }>();
const rawPromise = Promise.resolve({ id: 'raw' as const });
const rawOwned = DiBag.providerWithDisposal({ provider: DiBag.createProvider(() => rawPromise, { factoryReturnKind: 'uninspected' }), disposeService: value => { const exact: Promise<{ id: 'raw' }> = value; void exact; } });
const decoratedRaw = DiBag.providerWithRegistrationMetadata({ provider: rawOwned, registrationMetadata: { owner: 'scope' as const } });
const feature = DiBag.createBuilder().withServices({
  hidden: DiBag.providerWithLifetime({ provider: ({ external }: { external: { readonly exact: true } }) => external.exact, lifetime: 'scoped:one-per-container' }),
  publicValue: DiBag.providerWithLifetime({ provider: ({ hidden }: { hidden: true }) => ({ hidden }), lifetime: 'scoped:one-per-container' }),
}).buildModule({ exportedServiceKeys: ['publicValue'] }).withRenamedExport({ currentExportKey: 'publicValue', newExportKey: 'renamed' });

export const root = DiBag.createBuilder().withTokenService(exactToken, DiBag.providerWithLifetime({ provider: () => ({ id: 'token' as const, read: () => 7 }), lifetime: 'scoped:one-per-container' })).withInstalledModules([feature]).withServices({
    external: DiBag.providerWithLifetime({ provider: () => ({ exact: true as const, visible: 'wide' as const }), lifetime: 'scoped:one-per-container' }),
    asyncNamed: DiBag.providerWithLifetime({ provider: async ({ renamed }: { renamed: { hidden: true } }) => renamed.hidden ? 42 : 0, lifetime: 'scoped:one-per-container' }),
    rawOwned: DiBag.providerWithLifetime({ provider: decoratedRaw, lifetime: 'scoped:one-per-container' }),
  }).buildContainer();
export const child = root.createChildContainer();
export const grandchild = child.createChildContainer();
