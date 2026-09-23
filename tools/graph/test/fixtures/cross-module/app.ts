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

export const renamedRequirement = DiBag.createBuilder()
  .withInstalledModules([billingModule.withRenamedRequirement({ currentRequirementKey: 'shipping', newRequirementKey: 'delivery' })])
  .withServices({ delivery: () => ({ label: () => 'ok' }) })
  .buildContainer();

export const repeatedRequirement = DiBag.createBuilder()
  .withInstalledModules([billingModule
    .withRenamedRequirement({ currentRequirementKey: 'shipping', newRequirementKey: 'delivery' })
    .withRenamedRequirement({ currentRequirementKey: 'delivery', newRequirementKey: 'transport' })])
  .withServices({ transport: () => ({ label: () => 'ok' }) }).buildContainer();
export const exportFirstRequirement = DiBag.createBuilder()
  .withInstalledModules([billingModule
    .withRenamedExport({ currentExportKey: 'billing', newExportKey: 'invoice' })
    .withRenamedRequirement({ currentRequirementKey: 'shipping', newRequirementKey: 'delivery' })])
  .withServices({ delivery: () => ({ label: () => 'ok' }), invoiceReport: ({ invoice }: { invoice: { charge(): string } }) => invoice.charge() }).buildContainer();
export const requirementFirstExport = DiBag.createBuilder()
  .withInstalledModules([billingModule
    .withRenamedRequirement({ currentRequirementKey: 'shipping', newRequirementKey: 'delivery' })
    .withRenamedExport({ currentExportKey: 'billing', newExportKey: 'invoice' })])
  .withServices({ delivery: () => ({ label: () => 'ok' }), invoiceReport: ({ invoice }: { invoice: { charge(): string } }) => invoice.charge() }).buildContainer();
const nestedRequirementModule = DiBag.createBuilder()
  .withInstalledModules([billingModule.withRenamedRequirement({ currentRequirementKey: 'shipping', newRequirementKey: 'delivery' })])
  .buildModule({ exportedServiceKeys: ['billing'] });
export const nestedRequirementHost = DiBag.createBuilder()
  .withInstalledModules([nestedRequirementModule.withRenamedRequirement({ currentRequirementKey: 'delivery', newRequirementKey: 'transport' })])
  .withServices({ transport: () => ({ label: () => 'ok' }) }).buildContainer();
declare const requirementName: string;
declare const requirementOptions: { currentRequirementKey: string; newRequirementKey: string };
export const dynamicRequirement = DiBag.createBuilder()
  .withInstalledModules([billingModule.withRenamedRequirement({ currentRequirementKey: requirementName, newRequirementKey: 'delivery' })])
  .withServices({ delivery: () => ({ label: () => 'ok' }) }).buildContainer();
export const dynamicRequirementBag = DiBag.createBuilder()
  .withInstalledModules([billingModule.withRenamedRequirement(requirementOptions)])
  .withServices({ delivery: () => ({ label: () => 'ok' }) }).buildContainer();

const repeatedRequirementModule = DiBag.createBuilder()
  .withInstalledModules([billingModule
    .withRenamedRequirement({ currentRequirementKey: 'shipping', newRequirementKey: 'delivery' })
    .withRenamedRequirement({ currentRequirementKey: 'delivery', newRequirementKey: 'transport' })])
  .buildModule({ exportedServiceKeys: ['billing'] });
export const repeatedModuleHost = DiBag.createBuilder()
  .withInstalledModules([repeatedRequirementModule])
  .withServices({ transport: () => ({ label: () => 'ok' }) }).buildContainer();
const nestedTransportModule = DiBag.createBuilder()
  .withInstalledModules([nestedRequirementModule.withRenamedRequirement({ currentRequirementKey: 'delivery', newRequirementKey: 'transport' })])
  .buildModule({ exportedServiceKeys: ['billing'] });
export const nestedTransportHost = DiBag.createBuilder()
  .withInstalledModules([nestedTransportModule])
  .withServices({ transport: () => ({ label: () => 'ok' }) }).buildContainer();
export const missingRenamedRequirement = DiBag.createBuilder()
  .withInstalledModules([billingModule.withRenamedRequirement({ currentRequirementKey: 'shipping', newRequirementKey: 'delivery' })])
  .buildContainer();
export const missingNestedRequirement = DiBag.createBuilder()
  .withInstalledModules([nestedRequirementModule.withRenamedRequirement({ currentRequirementKey: 'delivery', newRequirementKey: 'transport' })])
  .buildContainer();
const opaqueRequirementModule = DiBag.createBuilder()
  .withInstalledModules([billingModule.withRenamedRequirement({ currentRequirementKey: requirementName, newRequirementKey: 'delivery' })])
  .buildModule({ exportedServiceKeys: [] });
export const opaqueNestedRequirement = DiBag.createBuilder()
  .withInstalledModules([opaqueRequirementModule]).buildContainer();
const emptyRequirementModule = DiBag.createBuilder()
  .withInstalledModules([billingModule.withRenamedRequirement({ currentRequirementKey: 'shipping', newRequirementKey: '' })])
  .buildModule({ exportedServiceKeys: ['billing'] });
export const emptyRequirementHost = DiBag.createBuilder()
  .withInstalledModules([emptyRequirementModule])
  .withServices({ '': () => ({ label: () => 'ok' }) }).buildContainer();
