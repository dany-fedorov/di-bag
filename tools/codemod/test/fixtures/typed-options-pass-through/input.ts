import { DiBag, type CloseOptions, type StartupOptions } from 'di-bag';

const builder = DiBag.createBuilder().register({ value: () => 1 });

export async function run(startupOptions: StartupOptions, closeOptions: CloseOptions) {
  const bag = await builder.buildAndStart(['value'], startupOptions);
  await bag.close(closeOptions);
}
