// tools/graph/test/fixtures/cross-module/parts.ts
import { DiBag } from '../../../../../src';
export const clockModule = DiBag.createBuilder().withServices({ clock: () => 0 }).buildModule({ exportedServiceKeys: ['clock'] });
export const loopModule = DiBag.createBuilder().withServices({
  x: ({ y }: { y: number }) => y,
  y: ({ x }: { x: number }) => x,
}).buildModule({ exportedServiceKeys: ['x'] });
export const labeledModule = DiBag.createBuilder().withServices({
  inner: ({ outerNeed }: { outerNeed: number }) => outerNeed,
  labeled: ({ inner }: { inner: number }) => inner,
}).buildModule({ exportedServiceKeys: ['labeled'], moduleLabel: 'orders' });
