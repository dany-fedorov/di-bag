import { DiBag, type CloseOptions, type EnsureServicesReadyOptions } from '../../src';
import type { AppServices, Storage, Transport } from './services';

export type AppAdapters = { readonly storage: Storage; readonly transport: Transport };

export interface AppRuntime {
  readonly services: AppServices;
  close(options?: CloseOptions): Promise<void>;
}

/**
 * The application graph. Built once at bootstrap, outside React, from adapters the
 * host chose. Every stage names its factory return kind: browsers have no
 * `process.getBuiltinModule`, so an auto-detect factory would throw `DI_BAG_CLASSIFIER_REQUIRED`.
 */
export function createAppBuilder(adapters: AppAdapters) {
  return DiBag.createBuilder().withServices({
    // Borrowed: IndexedDB-style storage has no close; the container never disposes it.
    storage: DiBag.providerWithLifetime({ provider: DiBag.createProvider((): Storage => adapters.storage, { factoryReturnKind: 'sync-value' }), lifetime: 'singleton:one-per-container-tree' }),
    // Owned: bootstrap hands the transport over, and the app container closes it exactly once.
    transport: DiBag.providerWithLifetime({ provider: DiBag.providerWithDisposal({ provider: DiBag.createProvider((): Transport => adapters.transport, { factoryReturnKind: 'sync-value' }), disposeService: transport => transport.close() }), lifetime: 'singleton:one-per-container-tree' }),
  });
}

export async function createAppRuntime(adapters: AppAdapters, options?: EnsureServicesReadyOptions): Promise<AppRuntime> {
  const container = await createAppBuilder(adapters).buildContainer().ensureServicesReady(['storage', 'transport'], options);
  const services: AppServices = { storage: container.resolve('storage'), transport: container.resolve('transport') };
  return { services, close: closeOptions => container.close(closeOptions) };
}
