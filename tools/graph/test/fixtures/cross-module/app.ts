// tools/graph/test/fixtures/cross-module/app.ts
// Modules imported from other files. The extractor does not require the fixture to type-check.
import { DiBag } from '../../../../../src/node';
import { billingModule } from './billing.js';
import { clockModule, labeledModule, loopModule } from './parts.js';
import { shippingModule } from './shipping.js';

// Each module's private service needs the other module's export.
export const cyclic = DiBag.createBuilder()
  .installModule(billingModule)
  .installModule(shippingModule)
  .build();

// The host never supplies billing's requirement.
export const missing = DiBag.createBuilder().installModule(billingModule).build();

export const renamed = DiBag.createBuilder()
  .installModule(clockModule.renameExport('clock', 'time'))
  .register({ report: ({ time }: { time: number }) => time })
  .build();

declare function makeModule(): typeof clockModule;
export const opaque = DiBag.createBuilder()
  .installModule(makeModule())
  .register({ report: ({ anything }: { anything: number }) => anything })
  .build();

export const hostOfLoop = DiBag.createBuilder().installModule(loopModule).build();

export const labeledHost = DiBag.createBuilder().installModule(labeledModule).build();
