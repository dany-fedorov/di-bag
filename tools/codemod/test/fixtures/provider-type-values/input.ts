import type { AcquisitionMode, PluginAcquisitionMode, PluginOptions, PluginProvider } from 'di-bag';
import type { PluginOptions as P } from 'di-bag';
import type * as DB from 'di-bag';

export type Direct = PluginOptions<'raw' | 'nativePromise', number>;
export type Alias = P<'raw', number>;
export type Namespace = DB.PluginOptions<'nativePromise', number>;
export type Imported = import('di-bag').PluginOptions<'raw', number>;
export type Nested = Readonly<PluginOptions<'raw', number>>;
export type Generic<Mode extends PluginAcquisitionMode> = P<Mode, number>;

export const mode: AcquisitionMode = 'raw';
export const pluginMode: PluginAcquisitionMode = 'nativePromise';
export type ExistingName = PluginProvider<readonly [], number, 'raw' | 'nativePromise'>;
