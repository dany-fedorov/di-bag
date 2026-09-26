import { feature, type InstallationRecord } from './module-installations.js';

const label: string | undefined = feature.moduleLabel;
declare const record: InstallationRecord;
const parent: symbol | undefined = record.parentInstallationId;
void label;
void parent;
// @ts-expect-error The emitted module label is read-only.
feature.moduleLabel = 'changed';
// @ts-expect-error The emitted installation record is read-only.
record.moduleLabel = 'changed';
