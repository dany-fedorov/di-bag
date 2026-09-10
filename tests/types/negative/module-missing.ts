import { DiBag } from '../../../src';
const module = DiBag.createBuilder().register({ value: ({ external }: { external: number }) => external }).buildModule(['value']);
// diagnostic: required service registrations are missing
DiBag.createBuilder().installModule(module).build();
