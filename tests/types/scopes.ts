import { DiBag } from '../../src';

const exactKey: unique symbol = Symbol('exact');
export const exactToken = DiBag.token(exactKey).of<{ readonly id: 'token'; read(): number }>();
const rawPromise = Promise.resolve({ id: 'raw' as const });
const rawOwned = DiBag.withDisposal(
  DiBag.factory(() => rawPromise, { acquisition: 'raw' }),
  value => { const exact: Promise<{ id: 'raw' }> = value; void exact; },
);
const decoratedRaw = DiBag.withMetadata(rawOwned, { owner: 'scope' as const });
const feature = DiBag.module().add({
  hidden: ({ external }: { external: { readonly exact: true } }) => external.exact,
  publicValue: ({ hidden }: { hidden: true }) => ({ hidden }),
}).exports(['publicValue']).rename('publicValue', 'renamed');

export const root = DiBag.begin()
  .bind(exactToken, () => ({ id: 'token' as const, read: () => 7 }))
  .install(feature)
  .add({
    external: () => ({ exact: true as const, visible: 'wide' as const }),
    asyncNamed: async ({ renamed }: { renamed: { hidden: true } }) => renamed.hidden ? 42 : 0,
    rawOwned: decoratedRaw,
  })
  .end();
export const child = root.scope();
export const grandchild = child.scope();
