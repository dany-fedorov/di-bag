import { DiBag } from '../../../src';
const module = DiBag.module().add({ value: ({ external }: { external: number }) => external }).exports(['value']);
// diagnostic: missing factories
DiBag.begin().install(module).end();
