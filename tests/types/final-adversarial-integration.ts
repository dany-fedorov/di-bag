import {
  DiBag,
  type ModuleProvides,
  type ProviderAcquired,
  type ProviderAcquisitionMetadata,
  type ProviderOutput,
  type ProviderTokenNeeds,
  type ValBoxFrame,
} from '../../src';
import { fromSasBox } from '../../src/sas-box';
import { fromValBox } from '../../src/val-box';
import { SasBox } from '../../.related-repos/sas-box/src';
import { ValBox } from '../../.related-repos/val-box/src';
import type { Assert, Equal } from './assert';

export const portKey = Symbol('final-adversarial-port');
export const port = DiBag.token(portKey).of<number>();

export class Client {
  constructor(readonly port: number) {}
  read() { return this.port; }
}

export interface PluginService {
  readonly plugin: true;
  readonly port: number;
}

export const client = DiBag.fromClass([port], Client);
export const plugin = DiBag.fromPlugin([port], {
  apiVersion: 1,
  create: (value: number) => ({ plugin: true as const, port: value }),
}, {
  acquisition: 'raw',
  validate: (value): value is PluginService => typeof value === 'object' && value !== null
    && Reflect.get(value, 'plugin') === true && typeof Reflect.get(value, 'port') === 'number',
});

const boxedSource = DiBag.fromFunction([port], value => SasBox.fromValue(
  new ValBox.WithValue.WithMetadata(
    { boxed: true as const, port: value },
    { origin: 'final-adversarial' as const },
    'final-adversarial',
  ),
));
export const boxed = fromValBox(fromSasBox(boxedSource, { mode: 'sync' }));

export const finalAdversarialFeature = DiBag.module()
  .bind(port, () => 8080)
  .add({ client, plugin, boxed })
  .alias('clientAlias', 'client')
  .exports(['client', 'plugin', 'boxed', 'clientAlias']);

export const finalAdversarialBag = DiBag.begin().install(finalAdversarialFeature).end();
export const finalAdversarialChild = finalAdversarialBag.scope(['plugin'], {
  plugin: () => ({ plugin: true as const, port: 9090, selected: true as const }),
}, { share: ['boxed'] });

type BoxedValue = { boxed: true; port: number };
export type FinalAdversarialProducerContracts = [
  Assert<Equal<ProviderOutput<typeof client>, Client>>,
  Assert<Equal<ProviderTokenNeeds<typeof client>, typeof port>>,
  Assert<Equal<ProviderOutput<typeof plugin>, PluginService>>,
  Assert<Equal<ProviderAcquired<typeof plugin>, PluginService>>,
  Assert<Equal<ProviderTokenNeeds<typeof plugin>, typeof port>>,
  Assert<Equal<ProviderOutput<typeof boxed>, BoxedValue>>,
  Assert<Equal<ProviderTokenNeeds<typeof boxed>, typeof port>>,
  Assert<Equal<ProviderAcquisitionMetadata<typeof boxed>, readonly [ValBoxFrame<{ origin: 'final-adversarial' }>]>>,
  Assert<Equal<ModuleProvides<typeof finalAdversarialFeature>['client'], Client>>,
  Assert<Equal<ReturnType<typeof finalAdversarialBag.resolve<'clientAlias'>>, Client>>,
  Assert<Equal<ReturnType<typeof finalAdversarialChild.resolve<'plugin'>>, { plugin: true; port: number; selected: true }>>,
];
