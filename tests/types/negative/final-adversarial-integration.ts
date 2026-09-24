import { DiBag } from '../../../src';

const annotatedValue = { annotated: true as const, port: 8080 };
const base = DiBag.createBuilder().withServices({
  annotated: DiBag.providerWithLifetime({ provider: () => annotatedValue, lifetime: 'scoped:one-per-container' }),
  plugin: DiBag.providerWithLifetime({ provider: () => ({ plugin: true as const, port: 8080 }), lifetime: 'scoped:one-per-container' }),
}).buildContainer();

// diagnostic: createChildContainer cannot share and replace the same service
base.createChildContainer(['annotated'], { annotated: DiBag.providerWithLifetime({ provider: () => annotatedValue, lifetime: 'scoped:one-per-container' }) }, { sharedParentServiceKeys: ['annotated'] });

// Sharing `annotated` is deliberately disjoint from overriding `plugin`, so this
// region can only be satisfied by the incompatible plugin output diagnostic.
// diagnostic: Type '() => { incompatible: boolean; }' is not assignable
base.createChildContainer(['plugin'], { plugin: DiBag.providerWithLifetime({ provider: () => ({ incompatible: true }), lifetime: 'scoped:one-per-container' }) }, { sharedParentServiceKeys: ['annotated'] });
