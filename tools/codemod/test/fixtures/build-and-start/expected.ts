import { DiBag, DiBagCloseCancelledError, DiBagServiceReadinessCancelledError, DiBagServiceReadinessError } from 'di-bag';
import type { EnsureServicesReadyOptions } from 'di-bag';

const builder = DiBag.createBuilder().register({
  db: async () => ({ ping: () => true }),
  cache: () => new Map<string, string>(),
});

export async function start(shutdown: AbortSignal, passedOptions: EnsureServicesReadyOptions, order: 'parallel' | 'sequential') {
  const plain = await builder.build().ensureServicesReady(['db']);
  const sequential = await builder.build().ensureServicesReady(['db', 'cache'], { abortSignal: shutdown, totalTimeoutMs: 5_000, maxConcurrentServiceKeys: 1 });
  const signal = shutdown;
  const bounded = await builder.build().ensureServicesReady(['db'], { abortSignal: signal, maxConcurrentServiceKeys: 4 });
  const parallel = await builder.build().ensureServicesReady(['db']);
  const mixed = await builder.build().ensureServicesReady(['db'], { totalTimeoutMs: 1_000 });
  const passed = await builder.build().ensureServicesReady(['db'], passedOptions);
  const unknownOrder = await builder.buildAndStart(['db'], { signal: shutdown as StartupOptions['signal'], timeoutMs: 3_000, startupOrder: order });
  const spreadOptions: EnsureServicesReadyOptions = { abortSignal: shutdown };
  const spread = await builder.buildAndStart(['db'], { timeoutMs: 3_000, ...spreadOptions });
  const chained = await DiBag.createBuilder()
    .register({ value: () => 1 })
    .build()
    .ensureServicesReady(['value'], {
      totalTimeoutMs: 2_000,
    });
  await plain.close({ abortSignal: shutdown, waitTimeoutMs: 10_000 });
  return [sequential, bounded, parallel, mixed, passed, unknownOrder, spread, chained];
}

export const typed: EnsureServicesReadyOptions = { totalTimeoutMs: 100, startupOrder: 'sequential' };

export function report(error: unknown): unknown {
  if (error instanceof DiBagCloseCancelledError) return [error.details.disposersStillRunning, error.details.acquisitionsStillPending, error.details.waitTimeoutMs, error.cleanupPromise];
  if (error instanceof DiBagServiceReadinessCancelledError) return error.disposalPromise;
  if (error instanceof DiBagServiceReadinessError && error.code === 'DI_BAG_SERVICE_READINESS_FAILED') return [error.disposalFailures, error.disposalError];
  return /DI_BAG_STARTUP_TIMEOUT/.test(String(error));
}
