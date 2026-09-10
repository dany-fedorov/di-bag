import { DiBag } from '../../../src';

const annotatedValue = { annotated: true as const, port: 8080 };
const base = DiBag.createBuilder().register({
  annotated: () => annotatedValue,
  plugin: () => ({ plugin: true as const, port: 8080 }),
}).build();

// diagnostic: createScope cannot share and override the same token
base.createScope(['annotated'], { annotated: () => annotatedValue }, { share: ['annotated'] });

// Sharing `annotated` is deliberately disjoint from overriding `plugin`, so this
// region can only be satisfied by the incompatible plugin output diagnostic.
// diagnostic: Type '() => { incompatible: boolean; }' is not assignable
base.createScope(['plugin'], { plugin: () => ({ incompatible: true }) }, { share: ['annotated'] });
