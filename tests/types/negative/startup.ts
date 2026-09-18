import { DiBag, type AcquisitionContext, type DisposerContext } from '../../../src';

const builder = DiBag.createBuilder().register({ value: () => 1 });
// diagnostic: buildAndStart accepts existing names or typed tokens only
builder.buildAndStart(['missing']);
const widened: string[] = ['value'];
// diagnostic: buildAndStart requires a finite tuple
builder.buildAndStart(widened);
declare const optional: readonly ['value'?];
// diagnostic: buildAndStart requires a finite tuple
builder.buildAndStart(optional);
// diagnostic: Expected 1-2 arguments
builder.buildAndStart();
// diagnostic: not assignable
builder.buildAndStart(['value'], { startupOrder: 'serial' });
// diagnostic: not assignable
builder.buildAndStart(['value'], { startupOrder: true });
// diagnostic: not assignable
builder.buildAndStart(['value'], { timeoutMs: '1' });
// diagnostic: missing the following properties from type 'AbortSignal'
builder.buildAndStart(['value'], { signal: {} });
// diagnostic: does not exist in type 'StartupOptions'
builder.buildAndStart(['value'], { extra: true });
const missing = DiBag.createBuilder().register({ value: DiBag.fromFactory((deps: { absent: number }, _factoryCtx) => deps.absent, { context: 'acquisition' }) });
// diagnostic: required service registrations are missing
missing.buildAndStart([]);
const captive = DiBag.createBuilder().register({
  scoped: () => 1,
  root: DiBag.withLifetime(DiBag.fromFactory((deps: { scoped: number }, _factoryCtx) => deps.scoped, { context: 'acquisition' }), 'root'),
});
// diagnostic: root lifetime cannot capture scoped dependency
captive.buildAndStart(['root']);
const exportless = DiBag.createBuilder().register({ hidden: (deps: { missing: number }) => deps.missing }).buildModule([]);
// diagnostic: required service registrations are missing
DiBag.createBuilder().installModule(exportless).buildAndStart([]);
const key: unique symbol = Symbol('token');
const otherKey: unique symbol = Symbol('token');
const token = DiBag.token(key).of<number>();
const other = DiBag.token(otherKey).of<number>();
// diagnostic: buildAndStart accepts existing names or typed tokens only
DiBag.createBuilder().register(token, () => 1).buildAndStart([other]);
// diagnostic: not assignable
DiBag.fromFactory(function (this: { required: true }, _deps: {}, _factoryCtx) { return 1; }, { context: 'acquisition' });
// diagnostic: Target signature provides too few arguments
DiBag.fromFactory((_deps: {}, _factoryCtx: AcquisitionContext, extra: number) => extra, { context: 'acquisition' });
// diagnostic: not assignable
DiBag.fromFactory((_deps: {}, _factoryCtx) => 1, { context: 'acquisition', ...{ acquisitionMode: 'nativePromise' } });
DiBag.fromFactory((_deps: {}, factoryCtx) => {
  // diagnostic: Cannot assign to 'signal' because it is a read-only property
  factoryCtx.signal = new AbortController().signal;
  // diagnostic: Property 'abort' does not exist on type 'AcquisitionContext'
  factoryCtx.abort();
  // diagnostic: Argument of type 'number' is not assignable to parameter of type '(this: void, disposerCtx: DisposerContext) => void | Promise<void>'
  factoryCtx.pushDisposer(1);
  // diagnostic: Target signature provides too few arguments. Expected 2 or more, but got 1.
  factoryCtx.pushDisposer((_disposerCtx: DisposerContext, extra: number) => extra);
  factoryCtx.pushDisposer(disposerCtx => {
    // diagnostic: Cannot assign to 'reason' because it is a read-only property
    disposerCtx.reason = 'factory-failed';
    // diagnostic: have no overlap
    if (disposerCtx.reason === 'disposed') return;
  });
}, { context: 'acquisition' });
const closable = DiBag.createBuilder().register({ value: () => 1 }).build();
// diagnostic: not assignable
closable.close({ timeoutMs: '1' });
// diagnostic: does not exist in type 'CloseOptions'
closable.close({ startupOrder: 'sequential' });
// diagnostic: missing the following properties from type 'AbortSignal'
closable.close({ signal: {} });
// diagnostic: not assignable
DiBag.createBuilder().register({ value: () => 1 }).buildModule(['value'], { label: 1 });
// diagnostic: does not exist in type 'ModuleOptions'
DiBag.createBuilder().register({ value: () => 1 }).buildModule(['value'], { name: 'x' });
