// tools/graph/test/fixtures/cross-module/app.ts
// Modules imported from other files. The extractor does not require the fixture to type-check.
import { DiBag } from '../../../../../src';
import { billingModule } from './billing.js';
import { clockModule, labeledModule, loopModule } from './parts.js';
import { shippingModule } from './shipping.js';

// Each module's private service needs the other module's export.
export const cyclic = DiBag.createBuilder()
  .withInstalledModules([billingModule])
  .withInstalledModules([shippingModule])
  .buildContainer();

// The host never supplies billing's requirement.
export const missing = DiBag.createBuilder().withInstalledModules([billingModule]).buildContainer();

export const renamed = DiBag.createBuilder()
  .withInstalledModules([clockModule.withRenamedExport({ currentExportKey: 'clock', newExportKey: 'time' })])
  .withServices({ report: ({ time }: { time: number }) => time })
  .buildContainer();

declare function makeModule(): typeof clockModule;
export const opaque = DiBag.createBuilder()
  .withInstalledModules([makeModule()])
  .withServices({ report: ({ anything }: { anything: number }) => anything })
  .buildContainer();

export const hostOfLoop = DiBag.createBuilder().withInstalledModules([loopModule]).buildContainer();

export const labeledHost = DiBag.createBuilder().withInstalledModules([labeledModule]).buildContainer();
