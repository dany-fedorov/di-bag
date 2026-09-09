import { DiBag, type Bag } from '../../../src';

const key: unique symbol = Symbol('token');
const missingKey: unique symbol = Symbol('token');
const token = DiBag.token(key).of<{ id: number }>();
const missingToken = DiBag.token(missingKey).of<{ id: number }>();
const feature = DiBag.module().add({
  hidden: ({ config }: { config: { id: string } }) => config.id,
  service: ({ hidden }: { hidden: string }) => hidden,
}).exports(['service']);
const parent = DiBag.begin().install(feature).bind(token, () => ({ id: 1 })).add({
  config: () => ({ id: 'parent' }),
  transient: DiBag.withLifetime(() => 1, 'transient'),
}).end();

// diagnostic: scope share accepts existing tokens only
parent.scope({ share: ['missing'] });
// diagnostic: scope share accepts existing tokens only
parent.scope({ share: ['hidden'] });
// diagnostic: scope share accepts existing tokens only
parent.scope({ share: [missingToken] });
// diagnostic: scope share requires a finite tuple
parent.scope({ share: [key] });
const array: string[] = ['config'];
// diagnostic: scope share requires a finite tuple
parent.scope({ share: array });
declare const uncertain: 'config' | 'service';
// diagnostic: scope share requires a finite tuple
parent.scope({ share: [uncertain] });
declare const optional: readonly ['config'?];
// diagnostic: scope share requires a finite tuple
parent.scope({ share: optional });
// diagnostic: scope cannot share transient providers
parent.scope({ share: ['transient'] });
// diagnostic: scope cannot share and override the same token
parent.scope(['config'], { config: () => ({ id: 'child' }) }, { share: ['config'] });
// diagnostic: scope cannot share and override the same token
parent.scope([token], { [key]: () => ({ id: 2 }) }, { share: [token] });
// diagnostic: scope accepts existing tokens only
parent.scope(['missing'], { missing: () => 1 });
// diagnostic: not assignable
parent.scope(['config'], {});
// diagnostic: Type '() => { id: number
parent.scope(['config'], { config: () => ({ id: 1 }) });
// diagnostic: Type '({ missing }: { missing: string; }) => { id: string; }' is not assignable
parent.scope(['config'], { config: ({ missing }: { missing: string }) => ({ id: missing }) });
// diagnostic: Type '({ transient }: { transient: string; }) => { id: string; }' is not assignable
parent.scope(['config'], { config: ({ transient }: { transient: string }) => ({ id: transient }) });
// diagnostic: Type '() => { id: string
parent.scope([token], { [key]: () => ({ id: 'wrong' }) });
// diagnostic: root lifetime cannot capture scoped dependency
parent.scope(['service'], { service: DiBag.withLifetime(({ config }: { config: { id: string } }) => config.id, 'root') });
// diagnostic: scope requires a finite tuple
parent.scope(array, { config: () => ({ id: 'child' }) });
// diagnostic: Property 'config' is missing
parent.scope<readonly ['config'], {}>(['config'], {});
// diagnostic: Object literal may only specify known properties
parent.scope({ share: [], extra: true });

const roots = DiBag.begin().add({
  config: DiBag.withLifetime(() => ({ id: 'root' }), 'root'),
  service: DiBag.withLifetime(({ config }: { config: { id: string } }) => config.id, 'root'),
}).end();
const child = roots.scope(['config'], { config: () => ({ id: 'child' }) });
// diagnostic: root lifetime cannot capture scoped dependency
child.fork();
// diagnostic: root lifetime cannot capture scoped dependency
child.fork([], {});

const borrowed = parent.scope({ share: ['service'] });
// diagnostic: is not assignable to type 'Bag
const erased: Bag<{ service: () => string; config: () => { id: string }; transient: () => number }> = borrowed;
void erased;
