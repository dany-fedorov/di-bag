import { DiBag, type AcquisitionContext } from '../../../src';

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
builder.buildAndStart(['value'], { timeoutMs: '1' });
// diagnostic: missing the following properties from type 'AbortSignal'
builder.buildAndStart(['value'], { signal: {} });
// diagnostic: does not exist in type 'StartupOptions'
builder.buildAndStart(['value'], { extra: true });
const missing = DiBag.createBuilder().register({ value: DiBag.fromFactory((deps: { absent: number }, _context) => deps.absent, { context: 'acquisition' }) });
// diagnostic: required service registrations are missing
missing.buildAndStart([]);
const captive = DiBag.createBuilder().register({
  scoped: () => 1,
  root: DiBag.withLifetime(DiBag.fromFactory((deps: { scoped: number }, _context) => deps.scoped, { context: 'acquisition' }), 'root'),
});
// diagnostic: root lifetime cannot capture scoped dependency
captive.buildAndStart(['root']);
const exportless = DiBag.createModuleBuilder().register({ hidden: (deps: { missing: number }) => deps.missing }).buildModule([]);
// diagnostic: required service registrations are missing
DiBag.createBuilder().installModule(exportless).buildAndStart([]);
const key: unique symbol = Symbol('token');
const otherKey: unique symbol = Symbol('token');
const token = DiBag.token(key).of<number>();
const other = DiBag.token(otherKey).of<number>();
// diagnostic: buildAndStart accepts existing names or typed tokens only
DiBag.createBuilder().register(token, () => 1).buildAndStart([other]);
// diagnostic: not assignable
DiBag.fromFactory(function (this: { required: true }, _deps: {}, _context) { return 1; }, { context: 'acquisition' });
// diagnostic: Target signature provides too few arguments
DiBag.fromFactory((_deps: {}, _context: AcquisitionContext, extra: number) => extra, { context: 'acquisition' });
// diagnostic: not assignable
DiBag.fromFactory((_deps: {}, _context) => 1, { context: 'acquisition', ...{ acquisitionMode: 'nativePromise' } });
DiBag.fromFactory((_deps: {}, context) => {
  // diagnostic: Cannot assign to 'signal' because it is a read-only property
  context.signal = new AbortController().signal;
  // diagnostic: Property 'abort' does not exist on type 'AcquisitionContext'
  context.abort();
}, { context: 'acquisition' });
