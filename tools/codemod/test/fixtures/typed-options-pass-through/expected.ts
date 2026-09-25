import { DiBag, type CloseOptions, type EnsureServicesReadyOptions } from 'di-bag';

const builder = DiBag.createBuilder().withServices({ value: () => 1 });

export async function run(startupOptions: EnsureServicesReadyOptions, closeOptions: CloseOptions) {
  const bag = await builder.buildContainer().ensureServicesReady(['value'], startupOptions);
  await bag.close(closeOptions);
}
