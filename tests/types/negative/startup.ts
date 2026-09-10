import { DiBag, type AcquisitionContext } from '../../../src';

const builder = DiBag.begin().add({ value: () => 1 });
// diagnostic: start accepts existing tokens only
builder.start(['missing']);
const widened: string[] = ['value'];
// diagnostic: start requires a finite tuple
builder.start(widened);
declare const optional: readonly ['value'?];
// diagnostic: start requires a finite tuple
builder.start(optional);
// diagnostic: Expected 1-2 arguments
builder.start();
// diagnostic: not assignable
builder.start(['value'], { concurrency: 'serial' });
// diagnostic: not assignable
builder.start(['value'], { concurrency: true });
// diagnostic: not assignable
builder.start(['value'], { timeoutMs: '1' });
// diagnostic: missing the following properties from type 'AbortSignal'
builder.start(['value'], { signal: {} });
// diagnostic: does not exist in type 'StartupOptions'
builder.start(['value'], { extra: true });
const missing = DiBag.begin().add({ value: DiBag.withContext((deps: { absent: number }, _context) => deps.absent) });
// diagnostic: missing factories
missing.start([]);
const captive = DiBag.begin().add({
  scoped: () => 1,
  root: DiBag.withLifetime(DiBag.withContext((deps: { scoped: number }, _context) => deps.scoped), 'root'),
});
// diagnostic: root lifetime cannot capture scoped dependency
captive.start(['root']);
const exportless = DiBag.module().add({ hidden: (deps: { missing: number }) => deps.missing }).exports([]);
// diagnostic: missing factories
DiBag.begin().install(exportless).start([]);
const key: unique symbol = Symbol('token');
const otherKey: unique symbol = Symbol('token');
const token = DiBag.token(key).of<number>();
const other = DiBag.token(otherKey).of<number>();
// diagnostic: start accepts existing tokens only
DiBag.begin().bind(token, () => 1).start([other]);
// diagnostic: not assignable
DiBag.withContext(function (this: { required: true }, _deps: {}, _context) { return 1; });
// diagnostic: Target signature provides too few arguments
DiBag.withContext((_deps: {}, _context: AcquisitionContext, extra: number) => extra);
// diagnostic: not assignable
DiBag.withContext((_deps: {}, _context) => 1, { acquisition: 'native' });
DiBag.withContext((_deps: {}, context) => {
  // diagnostic: Cannot assign to 'signal' because it is a read-only property
  context.signal = new AbortController().signal;
  // diagnostic: Property 'abort' does not exist on type 'AcquisitionContext'
  context.abort();
});
