import { DiBag } from '../../../src';
const owned = DiBag.withDisposal(() => 1, value => { value.toFixed(); });
// diagnostic: nominal
DiBag.createBuilder().withServices({ value: { ...owned, create: () => 'wrong' } });
// diagnostic: nominal
DiBag.createBuilder().withServices({ value: { ...owned } });
