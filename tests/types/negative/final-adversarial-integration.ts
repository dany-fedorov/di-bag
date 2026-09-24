import { DiBag } from '../../../src';

const annotatedValue = { annotated: true as const, port: 8080 };
const base = DiBag.createBuilder().withServices({
  annotated: () => annotatedValue,
  plugin: () => ({ plugin: true as const, port: 8080 }),
}).buildContainer();

// diagnostic: createChildContainer cannot share and replace the same service
base.createChildContainer(['annotated'], { annotated: () => annotatedValue }, { sharedParentServiceKeys: ['annotated'] });

// Sharing `annotated` is deliberately disjoint from overriding `plugin`, so this
// region can only be satisfied by the incompatible plugin output diagnostic.
// diagnostic: Type '() => { incompatible: boolean; }' is not assignable
base.createChildContainer(['plugin'], { plugin: () => ({ incompatible: true }) }, { sharedParentServiceKeys: ['annotated'] });
