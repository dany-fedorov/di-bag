import {
  DiBag,
  type ModuleExportedServices,
  type ProviderAcquiredValue,
  type ProviderAcquisitionMetadata,
  type ProviderOutput,
  type ProviderRequiredTokens,
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
  acquisitionMode: 'raw',
  validate: (value): value is PluginService => typeof value === 'object' && value !== null
    && Reflect.get(value, 'plugin') === true && typeof Reflect.get(value, 'port') === 'number',
});

const annotatedSource = DiBag.fromFunction([port], value => ({
  value: { annotated: true as const, port: value },
  metadata: { origin: 'final-adversarial' as const },
}));
export const annotated = DiBag.transformService(DiBag.withMetadata(annotatedSource, { dynamic: { mode: 'direct', describe: result => result.metadata } }), { mode: 'direct', transform: result => result.value });

export const finalAdversarialFeature = DiBag.createModuleBuilder().register(port, () => 8080).register({ client, plugin, annotated }).alias('clientAlias', 'client').buildModule(['client', 'plugin', 'annotated', 'clientAlias']);

export const finalAdversarialBag = DiBag.createBuilder().installModule(finalAdversarialFeature).build();
export const finalAdversarialChild = finalAdversarialBag.createScope(['plugin'], {
  plugin: () => ({ plugin: true as const, port: 9090, selected: true as const }),
}, { share: ['annotated'] });

type AnnotatedValue = { annotated: true; port: number };
export type FinalAdversarialProducerContracts = [
  Assert<Equal<ProviderOutput<typeof client>, Client>>,
  Assert<Equal<ProviderRequiredTokens<typeof client>, typeof port>>,
  Assert<Equal<ProviderOutput<typeof plugin>, PluginService>>,
  Assert<Equal<ProviderAcquiredValue<typeof plugin>, PluginService>>,
  Assert<Equal<ProviderRequiredTokens<typeof plugin>, typeof port>>,
  Assert<Equal<ProviderOutput<typeof annotated>, AnnotatedValue>>,
  Assert<Equal<ProviderRequiredTokens<typeof annotated>, typeof port>>,
  Assert<Equal<ProviderAcquisitionMetadata<typeof annotated>, readonly [Readonly<{ origin: 'final-adversarial' }>]>>,
  Assert<Equal<ModuleExportedServices<typeof finalAdversarialFeature>['client'], Client>>,
  Assert<Equal<ReturnType<typeof finalAdversarialBag.resolve<'clientAlias'>>, Client>>,
  Assert<Equal<ReturnType<typeof finalAdversarialChild.resolve<'plugin'>>, { plugin: true; port: number; selected: true }>>,
];
