// tools/graph/test/fixtures/cross-module/parts.ts
import { DiBag } from '../../../../../src/node';
export const clockModule = DiBag.createBuilder().register({ clock: () => 0 }).buildModule(['clock']);
export const loopModule = DiBag.createBuilder().register({
  x: ({ y }: { y: number }) => y,
  y: ({ x }: { x: number }) => x,
}).buildModule(['x']);
export const labeledModule = DiBag.createBuilder().register({
  inner: ({ outerNeed }: { outerNeed: number }) => outerNeed,
  labeled: ({ inner }: { inner: number }) => inner,
}).buildModule(['labeled'], { label: 'orders' });
