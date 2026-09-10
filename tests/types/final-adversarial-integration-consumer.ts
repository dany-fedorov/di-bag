import type {
  ModuleProvides,
  ProviderAcquired,
  ProviderAcquisitionMetadata,
  ProviderOutput,
  ProviderTokenNeeds,
} from '../../src';
import {
  Client,
  annotated,
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
const annotatedValue = finalAdversarialBag.resolve('annotated');
const selectedPlugin = finalAdversarialChild.resolve('plugin');
const sharedAnnotated = finalAdversarialChild.resolve('annotated');

export type FinalAdversarialConsumerContracts = [
  Assert<Equal<typeof clientValue, Client>>,
  Assert<Equal<typeof aliasValue, Client>>,
  Assert<Equal<typeof pluginValue, { readonly plugin: true; readonly port: number }>>,
  Assert<Equal<typeof annotatedValue, { annotated: true; port: number }>>,
  Assert<Equal<typeof selectedPlugin, { plugin: true; port: number; selected: true }>>,
  Assert<Equal<typeof sharedAnnotated, { annotated: true; port: number }>>,
  Assert<Equal<ProviderOutput<typeof client>, Client>>,
  Assert<Equal<ProviderTokenNeeds<typeof client>, typeof port>>,
  Assert<Equal<ProviderAcquired<typeof plugin>, { readonly plugin: true; readonly port: number }>>,
  Assert<Equal<ProviderOutput<typeof annotated>, { annotated: true; port: number }>>,
  Assert<Equal<ProviderTokenNeeds<typeof annotated>, typeof port>>,
  Assert<Equal<ProviderAcquisitionMetadata<typeof annotated>, readonly [Readonly<{ origin: 'final-adversarial' }>]>>,
  Assert<Equal<ModuleProvides<typeof finalAdversarialFeature>['clientAlias'], Client>>,
];
