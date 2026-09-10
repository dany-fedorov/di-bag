import { DiBag } from '../../src';

const exactKey: unique symbol = Symbol('exact');
export const exactToken = DiBag.token(exactKey).of<{ readonly id: 'token'; read(): number }>();
const rawPromise = Promise.resolve({ id: 'raw' as const });
const rawOwned = DiBag.withDisposal(
  DiBag.fromFactory(() => rawPromise, { acquisitionMode: 'raw' }),
  value => { const exact: Promise<{ id: 'raw' }> = value; void exact; },
);
const decoratedRaw = DiBag.withMetadata(rawOwned, { static: { owner: 'scope' as const } });
const feature = DiBag.createModuleBuilder().register({
  hidden: ({ external }: { external: { readonly exact: true } }) => external.exact,
  publicValue: ({ hidden }: { hidden: true }) => ({ hidden }),
}).buildModule(['publicValue']).renameExport('publicValue', 'renamed');

export const root = DiBag.createBuilder().register(exactToken, () => ({ id: 'token' as const, read: () => 7 })).installModule(feature).register({
    external: () => ({ exact: true as const, visible: 'wide' as const }),
    asyncNamed: async ({ renamed }: { renamed: { hidden: true } }) => renamed.hidden ? 42 : 0,
    rawOwned: decoratedRaw,
  }).build();
export const child = root.createScope();
export const grandchild = child.createScope();
