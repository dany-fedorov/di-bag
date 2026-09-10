import { DiBag, type Bag } from '../../../src';

const key: unique symbol = Symbol('token');
const missingKey: unique symbol = Symbol('token');
const token = DiBag.token(key).of<{ id: number }>();
const missingToken = DiBag.token(missingKey).of<{ id: number }>();
const feature = DiBag.createModuleBuilder().register({
  hidden: ({ config }: { config: { id: string } }) => config.id,
  service: ({ hidden }: { hidden: string }) => hidden,
}).buildModule(['service']);
const parent = DiBag.createBuilder().installModule(feature).register(token, () => ({ id: 1 })).register({
  config: () => ({ id: 'parent' }),
  transient: DiBag.withLifetime(() => 1, 'transient'),
}).build();

// diagnostic: createScope share accepts existing names or typed tokens only
parent.createScope({ share: ['missing'] });
// diagnostic: createScope share accepts existing names or typed tokens only
parent.createScope({ share: ['hidden'] });
// diagnostic: createScope share accepts existing names or typed tokens only
parent.createScope({ share: [missingToken] });
// diagnostic: createScope share requires a finite tuple
parent.createScope({ share: [key] });
const array: string[] = ['config'];
// diagnostic: createScope share requires a finite tuple
parent.createScope({ share: array });
declare const uncertain: 'config' | 'service';
// diagnostic: createScope share requires a finite tuple
parent.createScope({ share: [uncertain] });
declare const optional: readonly ['config'?];
// diagnostic: createScope share requires a finite tuple
parent.createScope({ share: optional });
// diagnostic: createScope cannot share transient providers
parent.createScope({ share: ['transient'] });
// diagnostic: createScope cannot share and override the same token
parent.createScope(['config'], { config: () => ({ id: 'child' }) }, { share: ['config'] });
// diagnostic: createScope cannot share and override the same token
parent.createScope([token], { [key]: () => ({ id: 2 }) }, { share: [token] });
// diagnostic: createScope accepts existing names or typed tokens only
parent.createScope(['missing'], { missing: () => 1 });
// diagnostic: not assignable
parent.createScope(['config'], {});
// diagnostic: Type '() => { id: number
parent.createScope(['config'], { config: () => ({ id: 1 }) });
// diagnostic: Type '({ missing }: { missing: string; }) => { id: string; }' is not assignable
parent.createScope(['config'], { config: ({ missing }: { missing: string }) => ({ id: missing }) });
// diagnostic: Type '({ transient }: { transient: string; }) => { id: string; }' is not assignable
parent.createScope(['config'], { config: ({ transient }: { transient: string }) => ({ id: transient }) });
// diagnostic: Type '() => { id: string
parent.createScope([token], { [key]: () => ({ id: 'wrong' }) });
// diagnostic: root lifetime cannot capture scoped dependency
parent.createScope(['service'], { service: DiBag.withLifetime(({ config }: { config: { id: string } }) => config.id, 'root') });
// diagnostic: createScope requires a finite tuple
parent.createScope(array, { config: () => ({ id: 'child' }) });
// diagnostic: Property 'config' is missing
parent.createScope<readonly ['config'], {}>(['config'], {});
// diagnostic: Object literal may only specify known properties
parent.createScope({ share: [], extra: true });

const roots = DiBag.createBuilder().register({
  config: DiBag.withLifetime(() => ({ id: 'root' }), 'root'),
  service: DiBag.withLifetime(({ config }: { config: { id: string } }) => config.id, 'root'),
}).build();
const child = roots.createScope(['config'], { config: () => ({ id: 'child' }) });
// diagnostic: root lifetime cannot capture scoped dependency
child.fork();
// diagnostic: root lifetime cannot capture scoped dependency
child.fork([], {});

const borrowed = parent.createScope({ share: ['service'] });
// diagnostic: is not assignable to type 'Bag
const erased: Bag<{ service: () => string; config: () => { id: string }; transient: () => number }> = borrowed;
void erased;
