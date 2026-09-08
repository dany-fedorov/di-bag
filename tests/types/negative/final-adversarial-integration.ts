import { DiBag } from '../../../src';

const boxedValue = { boxed: true as const, port: 8080 };
const base = DiBag.begin().add({
  boxed: () => boxedValue,
  plugin: () => ({ plugin: true as const, port: 8080 }),
}).end();

// diagnostic: scope cannot share and override the same token
base.scope(['boxed'], { boxed: () => boxedValue }, { share: ['boxed'] });

// Sharing `boxed` is deliberately disjoint from overriding `plugin`, so this
// region can only be satisfied by the incompatible plugin output diagnostic.
// diagnostic: Type '() => { incompatible: boolean; }' is not assignable
base.scope(['plugin'], { plugin: () => ({ incompatible: true }) }, { share: ['boxed'] });
