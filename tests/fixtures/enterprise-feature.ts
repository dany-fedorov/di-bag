import { DiBag } from '../../src';

export const disposals: string[] = [];
export function reset() { disposals.length = 0; }
const stepKey = Symbol('feature-step');
export const steps = DiBag.createToken(stepKey).forCollectionOf<(text: string) => string>();
const pluginKey = Symbol('feature-plugin');
const plugin = DiBag.createToken(pluginKey).forService<(text: string) => string>();
const descriptor: unknown = {
  apiVersion: 1,
  create: () => (text: string) => text.toUpperCase(),
  dispose: () => { disposals.push('plugin'); },
};
export const feature = DiBag.createBuilder().withTokenService(plugin, DiBag.createProviderFromPlugin({ dependencies: [], pluginDescriptor: descriptor, factoryReturnKind: 'uninspected', isValidPluginOutput: (value: unknown): value is (text: string) => string => typeof value === 'function' })).withServices({
  prefix: DiBag.providerWithDisposal({ provider: () => 'private:', disposeService: () => { disposals.push('private'); } }),
}).withCollectionContribution({ collectionToken: steps, provider: ({ prefix }: { prefix: string }) => (text: string) => prefix + text }).withCollectionContribution({ collectionToken: steps, provider: () => (text: string) => text + '!' }).withServices({
    handler: DiBag.providerWithDisposal({ provider: DiBag.createProviderFromFunction({ dependencies: [plugin, steps], factoryFunction: (transform, operations) =>
      (text: string) => operations.reduce((value, step) => step(value), transform(text)) }), disposeService: () => { disposals.push('handler'); } }),
  }).buildModule({ exportedServiceKeys: ['handler'] });
