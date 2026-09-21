import { DiBag } from 'di-bag';

const logging = DiBag.createBuilder().register({ logger: () => console }).buildModule(['logger']);
const clocks = DiBag.createBuilder().register({ clock: () => Date }).buildModule(['clock']);

export const app = DiBag.createBuilder()
  .withInstalledModules([logging])
  .withInstalledModules([clocks.withRenamedExport({ currentExportKey: 'clock', newExportKey: 'wallClock' })])
  .build();
