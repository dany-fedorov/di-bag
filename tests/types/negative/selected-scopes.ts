import { DiBag, type Container } from '../../../src';

const key: unique symbol = Symbol('token');
const missingKey: unique symbol = Symbol('token');
const token = DiBag.createToken(key).forService<{ id: number }>();
const missingToken = DiBag.createToken(missingKey).forService<{ id: number }>();
const feature = DiBag.createBuilder().withServices({
  hidden: DiBag.providerWithLifetime({ provider: ({ config }: { config: { id: string } }) => config.id, lifetime: 'scoped:one-per-container' }),
  service: DiBag.providerWithLifetime({ provider: ({ hidden }: { hidden: string }) => hidden, lifetime: 'scoped:one-per-container' }),
}).buildModule({ exportedServiceKeys: ['service'] });
const parent = DiBag.createBuilder().withInstalledModules([feature]).withTokenService(token, DiBag.providerWithLifetime({ provider: () => ({ id: 1 }), lifetime: 'scoped:one-per-container' })).withServices({
  config: DiBag.providerWithLifetime({ provider: () => ({ id: 'parent' }), lifetime: 'scoped:one-per-container' }),
  transient: DiBag.providerWithLifetime({ provider: () => 1, lifetime: 'transient:one-per-resolve' }),
}).buildContainer();

// diagnostic: createChildContainer sharedParentServiceKeys accepts existing names or typed tokens only
parent.createChildContainer({ sharedParentServiceKeys: ['missing'] });
// diagnostic: createChildContainer sharedParentServiceKeys accepts existing names or typed tokens only
parent.createChildContainer({ sharedParentServiceKeys: ['hidden'] });
// diagnostic: createChildContainer sharedParentServiceKeys accepts existing names or typed tokens only
parent.createChildContainer({ sharedParentServiceKeys: [missingToken] });
// diagnostic: createChildContainer sharedParentServiceKeys requires a finite tuple
parent.createChildContainer({ sharedParentServiceKeys: [key] });
const array: string[] = ['config'];
// diagnostic: createChildContainer sharedParentServiceKeys requires a finite tuple
parent.createChildContainer({ sharedParentServiceKeys: array });
declare const uncertain: 'config' | 'service';
// diagnostic: createChildContainer sharedParentServiceKeys requires a finite tuple
parent.createChildContainer({ sharedParentServiceKeys: [uncertain] });
declare const optional: readonly ['config'?];
// diagnostic: createChildContainer sharedParentServiceKeys requires a finite tuple
parent.createChildContainer({ sharedParentServiceKeys: optional });
// diagnostic: createChildContainer cannot share transient providers
parent.createChildContainer({ sharedParentServiceKeys: ['transient'] });
// diagnostic: createChildContainer cannot share and replace the same service
parent.createChildContainer(['config'], { config: DiBag.providerWithLifetime({ provider: () => ({ id: 'child' }), lifetime: 'scoped:one-per-container' }) }, { sharedParentServiceKeys: ['config'] });
// diagnostic: createChildContainer cannot share and replace the same service
parent.createChildContainer([token], { [key]: DiBag.providerWithLifetime({ provider: () => ({ id: 2 }), lifetime: 'scoped:one-per-container' }) }, { sharedParentServiceKeys: [token] });
// diagnostic: createChildContainer accepts existing names or typed tokens only
parent.createChildContainer(['missing'], { missing: DiBag.providerWithLifetime({ provider: () => 1, lifetime: 'scoped:one-per-container' }) });
// diagnostic: not assignable
parent.createChildContainer(['config'], {});
// diagnostic: Type '() => { id: number
parent.createChildContainer(['config'], { config: DiBag.providerWithLifetime({ provider: () => ({ id: 1 }), lifetime: 'scoped:one-per-container' }) });
// diagnostic: Type '({ missing }: { missing: string; }) => { id: string; }' is not assignable
parent.createChildContainer(['config'], { config: DiBag.providerWithLifetime({ provider: ({ missing }: { missing: string }) => ({ id: missing }), lifetime: 'scoped:one-per-container' }) });
// diagnostic: Type '({ transient }: { transient: string; }) => { id: string; }' is not assignable
parent.createChildContainer(['config'], { config: DiBag.providerWithLifetime({ provider: ({ transient }: { transient: string }) => ({ id: transient }), lifetime: 'scoped:one-per-container' }) });
// diagnostic: Type '() => { id: string
parent.createChildContainer([token], { [key]: DiBag.providerWithLifetime({ provider: () => ({ id: 'wrong' }), lifetime: 'scoped:one-per-container' }) });
// diagnostic: root lifetime cannot capture scoped dependency
parent.createChildContainer(['service'], { service: DiBag.providerWithLifetime({ provider: ({ config }: { config: { id: string } }) => config.id, lifetime: 'singleton:one-per-container-tree' }) });
// diagnostic: createChildContainer requires a finite tuple
parent.createChildContainer(array, { config: DiBag.providerWithLifetime({ provider: () => ({ id: 'child' }), lifetime: 'scoped:one-per-container' }) });
// diagnostic: Property 'config' is missing
parent.createChildContainer<readonly ['config'], {}>(['config'], {});
// diagnostic: Object literal may only specify known properties
parent.createChildContainer({ sharedParentServiceKeys: [], extra: true });

const roots = DiBag.createBuilder().withServices({
  config: DiBag.providerWithLifetime({ provider: () => ({ id: 'root' }), lifetime: 'singleton:one-per-container-tree' }),
  service: DiBag.providerWithLifetime({ provider: ({ config }: { config: { id: string } }) => config.id, lifetime: 'singleton:one-per-container-tree' }),
}).buildContainer();
const child = roots.createChildContainer(['config'], { config: DiBag.providerWithLifetime({ provider: () => ({ id: 'child' }), lifetime: 'scoped:one-per-container' }) });
// diagnostic: root lifetime cannot capture scoped dependency
child.createIndependentContainer();
// diagnostic: root lifetime cannot capture scoped dependency
child.createIndependentContainer([], {});

const borrowed = parent.createChildContainer({ sharedParentServiceKeys: ['service'] });
// diagnostic: is not assignable to type 'Container
const erased: Container<{ service: () => string; config: () => { id: string }; transient: () => number }> = borrowed;
void erased;
