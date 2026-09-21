import { DiBag, DiBagCloseCancelledError, DiBagStartupCancelledError, DiBagStartupError, type StartupOptions } from 'di-bag';

const builder = DiBag.createBuilder().register({ db: async () => 1, cache: () => 2 });

export async function main(signal: AbortSignal, options: StartupOptions, bound: number) {
  const plain = await builder.buildAndStart(['db']);
  const all = await builder.buildAndStart(['db', 'cache'], { signal, timeoutMs: 5_000, startupOrder: 'sequential' });
  const parallel = await builder.buildAndStart(['db'], { startupOrder: 'parallel' });
  const four = await builder.buildAndStart(['db'], { startupOrder: 4, signal: signal });
  const computed = await builder.buildAndStart(['db'], { startupOrder: bound });
  const passed = await builder.buildAndStart(['db'], options);
  await plain.close({ timeoutMs: 1_000, signal });
  try {
    await builder.buildAndStart(['db']);
  } catch (error) {
    if (error instanceof DiBagStartupError) console.error(error.code === 'DI_BAG_STARTUP_FAILED', error.cleanupFailures, error.cleanupError);
    if (error instanceof DiBagStartupCancelledError) await error.cleanupPromise;
    if (error instanceof DiBagCloseCancelledError) console.error(error.details.pending, error.details.acquiring, error.cleanupPromise);
  }
  return [all, parallel, four, computed, passed];
}
