import { DiBag, type Container } from '../../../src';

const key: unique symbol = Symbol('token');
const missingKey: unique symbol = Symbol('token');
const token = DiBag.token(key).of<{ id: number }>();
const missingToken = DiBag.token(missingKey).of<{ id: number }>();
const feature = DiBag.createBuilder().withServices({
  hidden: ({ config }: { config: { id: string } }) => config.id,
  service: ({ hidden }: { hidden: string }) => hidden,
}).buildModule({ exportedServiceKeys: ['service'] });
const parent = DiBag.createBuilder().withInstalledModules([feature]).withTokenService(token, () => ({ id: 1 })).withServices({
  config: () => ({ id: 'parent' }),
  transient: DiBag.withLifetime(() => 1, 'transient'),
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
parent.createChildContainer(['config'], { config: () => ({ id: 'child' }) }, { sharedParentServiceKeys: ['config'] });
// diagnostic: createChildContainer cannot share and replace the same service
parent.createChildContainer([token], { [key]: () => ({ id: 2 }) }, { sharedParentServiceKeys: [token] });
// diagnostic: createChildContainer accepts existing names or typed tokens only
parent.createChildContainer(['missing'], { missing: () => 1 });
// diagnostic: not assignable
parent.createChildContainer(['config'], {});
// diagnostic: Type '() => { id: number
parent.createChildContainer(['config'], { config: () => ({ id: 1 }) });
// diagnostic: Type '({ missing }: { missing: string; }) => { id: string; }' is not assignable
parent.createChildContainer(['config'], { config: ({ missing }: { missing: string }) => ({ id: missing }) });
// diagnostic: Type '({ transient }: { transient: string; }) => { id: string; }' is not assignable
parent.createChildContainer(['config'], { config: ({ transient }: { transient: string }) => ({ id: transient }) });
// diagnostic: Type '() => { id: string
parent.createChildContainer([token], { [key]: () => ({ id: 'wrong' }) });
// diagnostic: root lifetime cannot capture scoped dependency
parent.createChildContainer(['service'], { service: DiBag.withLifetime(({ config }: { config: { id: string } }) => config.id, 'root') });
// diagnostic: createChildContainer requires a finite tuple
parent.createChildContainer(array, { config: () => ({ id: 'child' }) });
// diagnostic: Property 'config' is missing
parent.createChildContainer<readonly ['config'], {}>(['config'], {});
// diagnostic: Object literal may only specify known properties
parent.createChildContainer({ sharedParentServiceKeys: [], extra: true });

const roots = DiBag.createBuilder().withServices({
  config: DiBag.withLifetime(() => ({ id: 'root' }), 'root'),
  service: DiBag.withLifetime(({ config }: { config: { id: string } }) => config.id, 'root'),
}).buildContainer();
const child = roots.createChildContainer(['config'], { config: () => ({ id: 'child' }) });
// diagnostic: root lifetime cannot capture scoped dependency
child.createIndependentContainer();
// diagnostic: root lifetime cannot capture scoped dependency
child.createIndependentContainer([], {});

const borrowed = parent.createChildContainer({ sharedParentServiceKeys: ['service'] });
// diagnostic: is not assignable to type 'Bag
const erased: Container<{ service: () => string; config: () => { id: string }; transient: () => number }> = borrowed;
void erased;
