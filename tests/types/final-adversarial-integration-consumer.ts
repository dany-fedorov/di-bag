import type {
  ModuleProvides,
  ProviderAcquired,
  ProviderAcquisitionMetadata,
  ProviderOutput,
  ProviderTokenNeeds,
  ValBoxFrame,
} from '../../src';
import {
  Client,
  boxed,
  client,
  finalAdversarialBag,
  finalAdversarialChild,
  finalAdversarialFeature,
  plugin,
  port,
} from './final-adversarial-integration';
import type { Assert, Equal } from './assert';

const clientValue = finalAdversarialBag.resolve('client');
const aliasValue = finalAdversarialBag.resolve('clientAlias');
const pluginValue = finalAdversarialBag.resolve('plugin');
const boxedValue = finalAdversarialBag.resolve('boxed');
const selectedPlugin = finalAdversarialChild.resolve('plugin');
const sharedBoxed = finalAdversarialChild.resolve('boxed');

export type FinalAdversarialConsumerContracts = [
  Assert<Equal<typeof clientValue, Client>>,
  Assert<Equal<typeof aliasValue, Client>>,
  Assert<Equal<typeof pluginValue, { readonly plugin: true; readonly port: number }>>,
  Assert<Equal<typeof boxedValue, { boxed: true; port: number }>>,
  Assert<Equal<typeof selectedPlugin, { plugin: true; port: number; selected: true }>>,
  Assert<Equal<typeof sharedBoxed, { boxed: true; port: number }>>,
  Assert<Equal<ProviderOutput<typeof client>, Client>>,
  Assert<Equal<ProviderTokenNeeds<typeof client>, typeof port>>,
  Assert<Equal<ProviderAcquired<typeof plugin>, { readonly plugin: true; readonly port: number }>>,
  Assert<Equal<ProviderOutput<typeof boxed>, { boxed: true; port: number }>>,
  Assert<Equal<ProviderAcquisitionMetadata<typeof boxed>, readonly [ValBoxFrame<{ origin: 'final-adversarial' }>]>>,
  Assert<Equal<ModuleProvides<typeof finalAdversarialFeature>['clientAlias'], Client>>,
];
