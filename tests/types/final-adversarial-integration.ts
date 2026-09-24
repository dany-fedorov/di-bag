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
export const port = DiBag.createToken(portKey).forService<number>();

export class Client {
  constructor(readonly port: number) {}
  read() { return this.port; }
}

export interface PluginService {
  readonly plugin: true;
  readonly port: number;
}

export const client = DiBag.createProviderFromClass({ dependencies: [port], serviceClass: Client });
export const plugin = DiBag.createProviderFromPlugin({ dependencies: [port], pluginDescriptor: {
  apiVersion: 1,
  create: (value: number) => ({ plugin: true as const, port: value }),
}, factoryReturnKind: 'uninspected', isValidPluginOutput: (value): value is PluginService => typeof value === 'object' && value !== null
    && Reflect.get(value, 'plugin') === true && typeof Reflect.get(value, 'port') === 'number' });

const annotatedSource = DiBag.createProviderFromFunction({ dependencies: [port], factoryFunction: value => ({
  value: { annotated: true as const, port: value },
  metadata: { origin: 'final-adversarial' as const },
}) });
export const annotated = DiBag.providerWithTransformedService({ provider: DiBag.providerWithAcquisitionMetadata({ provider: annotatedSource, describeAcquisition: result => result.metadata, callbackReceives: 'exposed-service' }), transformService: result => result.value, callbackReceives: 'exposed-service' });

export const finalAdversarialFeature = DiBag.createBuilder().withTokenService(port, DiBag.providerWithLifetime({ provider: () => 8080, lifetime: 'scoped:one-per-container' })).withServices({ client: DiBag.providerWithLifetime({ provider: client, lifetime: 'scoped:one-per-container' }), plugin: DiBag.providerWithLifetime({ provider: plugin, lifetime: 'scoped:one-per-container' }), annotated: DiBag.providerWithLifetime({ provider: annotated, lifetime: 'scoped:one-per-container' }) }).withServiceAlias({ aliasKey: 'clientAlias', targetServiceKey: 'client' }).buildModule({ exportedServiceKeys: ['client', 'plugin', 'annotated', 'clientAlias'] });

export const finalAdversarialBag = DiBag.createBuilder().withInstalledModules([finalAdversarialFeature]).buildContainer();
export const finalAdversarialChild = finalAdversarialBag.createChildContainer(['plugin'], {
  plugin: DiBag.providerWithLifetime({ provider: () => ({ plugin: true as const, port: 9090, selected: true as const }), lifetime: 'scoped:one-per-container' }),
}, { sharedParentServiceKeys: ['annotated'] });

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
