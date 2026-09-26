import { DiBag, type ModuleInstallationSnapshot } from '../../src';

export const feature = DiBag.createBuilder().buildModule({ exportedServiceKeys: [], moduleLabel: 'empty' });
export type InstallationRecord = ModuleInstallationSnapshot;
const label: string | undefined = feature.moduleLabel;
void label;
// @ts-expect-error Module labels are read-only.
feature.moduleLabel = 'changed';
const graph = DiBag.createBuilder().withInstalledModules([feature]).buildContainer().graphSnapshot();
const records: readonly ModuleInstallationSnapshot[] = graph.moduleInstallations;
// @ts-expect-error Snapshot records are read-only.
records[0]!.moduleLabel = 'changed';
// @ts-expect-error Snapshot arrays are read-only.
records.push(records[0]!);
const origin: symbol | undefined = graph.bindings[0]?.moduleInstallationId;
void origin;
