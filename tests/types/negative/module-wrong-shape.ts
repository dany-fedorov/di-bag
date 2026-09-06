import { DiBag } from '../../../src';
const module = DiBag.module().add({ value: ({ external }: { external: number }) => external }).exports(['value']);
// diagnostic: a dependency has the wrong shape
DiBag.begin().install(module).add({ external: () => 'wrong' });
// diagnostic: a dependency has the wrong shape
DiBag.begin().add({ external: () => 'wrong' }).install(module);
const other = DiBag.module().add({ value2: ({ external }: { external: string }) => external }).exports(['value2']);
// diagnostic: a dependency has the wrong shape
DiBag.begin().install(module).install(other).add({ external: () => 1 });
