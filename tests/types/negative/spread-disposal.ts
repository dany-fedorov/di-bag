import { DiBag } from '../../../src';
const owned = DiBag.providerWithDisposal({ provider: () => 1, disposeService: value => { value.toFixed(); } });
// diagnostic: nominal
DiBag.createBuilder().withServices({ value: { ...owned, create: () => 'wrong' } });
// diagnostic: not assignable
DiBag.createBuilder().withServices({ value: { ...owned } });
