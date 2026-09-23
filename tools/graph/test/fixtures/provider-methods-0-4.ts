import { DiBag } from './provider-sources-0-4-library.js';

const derived = DiBag.withConfiguration({});
const legacy = DiBag.withLifetime(DiBag.withDisposal(() => 1, () => {}), 'root');
const derivedLegacy = derived.withLifetime(derived.withDisposal(() => 6, () => {}), 'transient');

export const container = DiBag.createBuilder().register({ legacy, derivedLegacy }).build();
