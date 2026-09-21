import { DiBag, DiBagCloseCancelledError, DiBagStartupCancelledError, DiBagStartupError } from 'di-bag';
import type { StartupOptions } from 'di-bag';

const builder = DiBag.createBuilder().register({
  db: async () => ({ ping: () => true }),
  cache: () => new Map<string, string>(),
});

export async function start(shutdown: AbortSignal, passedOptions: StartupOptions, order: 'parallel' | 'sequential') {
  const plain = await builder.buildAndStart(['db']);
  const sequential = await builder.buildAndStart(['db', 'cache'], { signal: shutdown, timeoutMs: 5_000, startupOrder: 'sequential' });
  const signal = shutdown;
  const bounded = await builder.buildAndStart(['db'], { signal, startupOrder: 4 });
  const parallel = await builder.buildAndStart(['db'], { startupOrder: 'parallel' });
  const mixed = await builder.buildAndStart(['db'], { startupOrder: 'parallel', timeoutMs: 1_000 });
  const passed = await builder.buildAndStart(['db'], passedOptions);
  const unknownOrder = await builder.buildAndStart(['db'], { signal: shutdown as StartupOptions['signal'], timeoutMs: 3_000, startupOrder: order });
  const spreadOptions: StartupOptions = { signal: shutdown };
  const spread = await builder.buildAndStart(['db'], { timeoutMs: 3_000, ...spreadOptions });
  const chained = await DiBag.createBuilder()
    .register({ value: () => 1 })
    .buildAndStart(['value'], {
      timeoutMs: 2_000,
    });
  await plain.close({ signal: shutdown, timeoutMs: 10_000 });
  return [sequential, bounded, parallel, mixed, passed, unknownOrder, spread, chained];
}

export const typed: StartupOptions = { timeoutMs: 100, startupOrder: 'sequential' };

export function report(error: unknown): unknown {
  if (error instanceof DiBagCloseCancelledError) return [error.details.pending, error.details.acquiring, error.details.timeoutMs, error.cleanupPromise];
  if (error instanceof DiBagStartupCancelledError) return error.cleanupPromise;
  if (error instanceof DiBagStartupError && error.code === 'DI_BAG_STARTUP_FAILED') return [error.cleanupFailures, error.cleanupError];
  return /DI_BAG_STARTUP_TIMEOUT/.test(String(error));
}
