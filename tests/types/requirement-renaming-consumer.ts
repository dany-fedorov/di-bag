import { DiBag, type ModuleRequiredServices } from '../../src';
import { renamed, rerouted } from './requirement-renaming.js';
import type { Assert, Equal } from './assert';
type Config = { value: number };
export type First = Assert<Equal<ModuleRequiredServices<typeof renamed>, Readonly<{ featureConfig: Config }>>>;
export type Second = Assert<Equal<ModuleRequiredServices<typeof rerouted>, Readonly<{ appConfig: Config }>>>;
DiBag.createBuilder().withInstalledModules([rerouted]).withServices({ appConfig: (): Config => ({ value: 2 }) }).buildContainer();
