import { DiBag, DiBagCloseCancelledError, DiBagServiceReadinessCancelledError, DiBagServiceReadinessError, type EnsureServicesReadyOptions } from 'di-bag';

const builder = DiBag.createBuilder().withServices({ db: async () => 1, cache: () => 2 });

export async function main(signal: AbortSignal, options: EnsureServicesReadyOptions, bound: number) {
  const plain = await builder.buildContainer().ensureServicesReady(['db']);
  const all = await builder.buildContainer().ensureServicesReady(['db', 'cache'], { abortSignal: signal, totalTimeoutMs: 5_000, maxConcurrentServiceKeys: 1 });
  const parallel = await builder.buildContainer().ensureServicesReady(['db']);
  const four = await builder.buildContainer().ensureServicesReady(['db'], { maxConcurrentServiceKeys: 4, abortSignal: signal });
  const computed = await builder.buildAndStart(['db'], { startupOrder: bound });
  const passed = await builder.buildContainer().ensureServicesReady(['db'], options);
  await plain.close({ waitTimeoutMs: 1_000, abortSignal: signal });
  try {
    await builder.buildContainer().ensureServicesReady(['db']);
  } catch (error) {
    if (error instanceof DiBagServiceReadinessError) console.error(error.code === 'DI_BAG_SERVICE_READINESS_FAILED', error.disposalFailures, error.disposalError);
    if (error instanceof DiBagServiceReadinessCancelledError) await error.disposalPromise;
    if (error instanceof DiBagCloseCancelledError) console.error(error.details.disposersStillRunning, error.details.acquisitionsStillPending, error.disposalPromise);
  }
  return [all, parallel, four, computed, passed];
}
