import type { FactoryReturnKind, PluginReturnKind, CreateProviderFromPluginOptions, PluginProvider } from 'di-bag';
import type { CreateProviderFromPluginOptions as P } from 'di-bag';
import type * as DB from 'di-bag';

export type Direct = CreateProviderFromPluginOptions<'uninspected' | 'native-promise', number>;
export type Alias = P<'uninspected', number>;
export type Namespace = DB.CreateProviderFromPluginOptions<'native-promise', number>;
export type Imported = import('di-bag').CreateProviderFromPluginOptions<'uninspected', number>;
export type Nested = Readonly<CreateProviderFromPluginOptions<'uninspected', number>>;
export type Generic<Mode extends PluginReturnKind> = P<Mode, number>;

export const mode: FactoryReturnKind = 'uninspected';
export const pluginMode: PluginReturnKind = 'native-promise';
export type ExistingName = PluginProvider<readonly [], number, 'uninspected' | 'native-promise'>;
