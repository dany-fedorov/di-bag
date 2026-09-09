import {
  DiBag,
  type ModuleProvides,
  type ProviderAcquired,
  type ProviderAcquisitionMetadata,
  type ProviderOutput,
  type ProviderTokenNeeds,
} from '../../src';
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

const annotatedSource = DiBag.fromFunction([port], value => ({
  value: { annotated: true as const, port: value },
  metadata: { origin: 'final-adversarial' as const },
}));
export const annotated = DiBag.mapSync(
  DiBag.withAcquisitionMetadata(annotatedSource, result => result.metadata),
  result => result.value,
);

export const finalAdversarialFeature = DiBag.module()
  .bind(port, () => 8080)
  .add({ client, plugin, annotated })
  .alias('clientAlias', 'client')
  .exports(['client', 'plugin', 'annotated', 'clientAlias']);

export const finalAdversarialBag = DiBag.begin().install(finalAdversarialFeature).end();
export const finalAdversarialChild = finalAdversarialBag.scope(['plugin'], {
  plugin: () => ({ plugin: true as const, port: 9090, selected: true as const }),
}, { share: ['annotated'] });

type AnnotatedValue = { annotated: true; port: number };
export type FinalAdversarialProducerContracts = [
  Assert<Equal<ProviderOutput<typeof client>, Client>>,
  Assert<Equal<ProviderTokenNeeds<typeof client>, typeof port>>,
  Assert<Equal<ProviderOutput<typeof plugin>, PluginService>>,
  Assert<Equal<ProviderAcquired<typeof plugin>, PluginService>>,
  Assert<Equal<ProviderTokenNeeds<typeof plugin>, typeof port>>,
  Assert<Equal<ProviderOutput<typeof annotated>, AnnotatedValue>>,
  Assert<Equal<ProviderTokenNeeds<typeof annotated>, typeof port>>,
  Assert<Equal<ProviderAcquisitionMetadata<typeof annotated>, readonly [Readonly<{ origin: 'final-adversarial' }>]>>,
  Assert<Equal<ModuleProvides<typeof finalAdversarialFeature>['client'], Client>>,
  Assert<Equal<ReturnType<typeof finalAdversarialBag.resolve<'clientAlias'>>, Client>>,
  Assert<Equal<ReturnType<typeof finalAdversarialChild.resolve<'plugin'>>, { plugin: true; port: number; selected: true }>>,
];
