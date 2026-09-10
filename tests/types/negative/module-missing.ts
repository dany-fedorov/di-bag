import { DiBag } from '../../../src';
const module = DiBag.createModuleBuilder().register({ value: ({ external }: { external: number }) => external }).buildModule(['value']);
// diagnostic: required service registrations are missing
DiBag.createBuilder().installModule(module).build();
