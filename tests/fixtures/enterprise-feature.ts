import { DiBag } from '../../src/node';

export const disposals: string[] = [];
export function reset() { disposals.length = 0; }
const stepKey = Symbol('feature-step');
export const steps = DiBag.token(stepKey).of<(text: string) => string>();
const pluginKey = Symbol('feature-plugin');
const plugin = DiBag.token(pluginKey).of<(text: string) => string>();
const descriptor: unknown = {
  apiVersion: 1,
  create: () => (text: string) => text.toUpperCase(),
  dispose: () => { disposals.push('plugin'); },
};
export const feature = DiBag.createModuleBuilder().register(plugin, DiBag.fromPlugin([], descriptor, {
  acquisitionMode: 'raw',
  validate: (value: unknown): value is (text: string) => string => typeof value === 'function',
})).register({
  prefix: DiBag.withDisposal(() => 'private:', () => { disposals.push('private'); }),
}).contribute(steps, ({ prefix }: { prefix: string }) => (text: string) => prefix + text).contribute(steps, () => (text: string) => text + '!').register({
    handler: DiBag.withDisposal(DiBag.fromFunction([plugin, DiBag.all(steps)], (transform, operations) =>
      (text: string) => operations.reduce((value, step) => step(value), transform(text))),
    () => { disposals.push('handler'); }),
  }).buildModule(['handler']);
