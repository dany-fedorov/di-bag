import { DiBag } from '../../../src';

const builder = DiBag.createBuilder().withServices({ clock: () => 1 });
const requiredSelf = DiBag.providerWithDisposal({ provider: ({ clock }: { clock: number }) => clock, disposeService: () => {} });
// diagnostic: not assignable to parameter of type 'never'
builder.withReplacedService('clock', requiredSelf);
const optionalSelf = DiBag.providerWithDisposal({ provider: ({ clock }: { clock?: number }) => clock ?? 0, disposeService: () => {} });
// diagnostic: not assignable to parameter of type 'never'
builder.withReplacedService('clock', optionalSelf);
const safe = DiBag.providerWithDisposal({ provider: () => 1, disposeService: () => {} });
const mixed = Math.random() ? safe : requiredSelf;
// diagnostic: not assignable to parameter of type 'never'
builder.withReplacedService('clock', mixed);

const neverDependencies = DiBag.providerWithDisposal({ provider: (_dependencies: never) => 1, disposeService: () => {} });
// diagnostic: factory dependencies must be finite
builder.withReplacedService('clock', neverDependencies);
const unknownDependencies = DiBag.providerWithDisposal({ provider: (_dependencies: unknown) => 1, disposeService: () => {} });
// diagnostic: factory dependencies must be finite
builder.withReplacedService('clock', unknownDependencies);
const indexedDependencies = DiBag.providerWithDisposal({ provider: (_dependencies: { [key: string]: number }) => 1, disposeService: () => {} });
// diagnostic: No overload matches
builder.withReplacedService('clock', indexedDependencies);
