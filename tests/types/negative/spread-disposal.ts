import { DiBag } from '../../../src';
const owned = DiBag.withDisposal(() => 1, value => { value.toFixed(); });
// diagnostic: nominal
DiBag.begin().add({ value: { ...owned, create: () => 'wrong' } });
// diagnostic: nominal
DiBag.begin().add({ value: { ...owned } });
