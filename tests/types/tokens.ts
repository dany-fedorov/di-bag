import { DiBag, type Provider, type Module, type ProviderOutput, type ProviderAcquisitionMetadata, type ModuleProvides, type FramePresenceTuple } from '../../src';
import { fromValBox } from '../../src/val-box';
import type { Assert, Equal } from './assert';
const key = Symbol('service'); const token = DiBag.token(key).of<{ value: number }>();
const rewrapped = DiBag.token(key).of<{ value: number }>();
const promiseKey = Symbol('promise'); const promiseToken = DiBag.token(promiseKey).of<Promise<number>>();
const promised = Promise.resolve(3);
const source = DiBag.withMetadata(() => ({ value: 1, rich: true as const }), { owner: 'team' });
const bag = DiBag.begin().bind(token, source).bind(promiseToken, () => promised)
  .add({ read: DiBag.fromTokens([rewrapped, promiseToken], (value, promise) => ({ value: value.value, promise })) }).end();
const value = bag.resolve(rewrapped); const promise = bag.resolve(promiseToken); const inspection = bag.inspect(token);
type Exact = [Assert<Equal<typeof value, { value: number; rich: true }>>, Assert<Equal<typeof promise, Promise<number>>>,
  Assert<Equal<typeof inspection.metadata, Readonly<{ owner: string }>>>];
const module = DiBag.module().bind(token, source).exports([token]);
type Public = Assert<Equal<ModuleProvides<typeof module>, Readonly<{ [key]: { value: number; rich: true } }>>>;
const replaced = DiBag.begin().bind(token, source).replace(token, () => ({ value: 2, newer: true as const })).end().resolve(token);
type Replacement = Assert<Equal<typeof replaced, { value: number; newer: true }>>;
const moduleReplacement = DiBag.module().bind(token, source).replace(token, () => ({ value: 3, module: true as const })).exports([token]);
const moduleValue = DiBag.begin().install(moduleReplacement).end().resolve(token);
type ModuleReplacement = Assert<Equal<typeof moduleValue, { value: number; module: true }>>;
const namedNeeds = ({ name }: { name: string }) => ({ value: name.length });
DiBag.begin().bind(token, namedNeeds).add({ name: () => 'ok' }).end();
DiBag.begin().add({ name: () => 'ok' }).bind(token, namedNeeds).end();
const plainModule: Module<{ value: number }, {}> = DiBag.module().add({ value: () => 1 }).exports(['value']);
const plainProvider: Provider<() => number> = DiBag.fromTokens([], () => 1);
const frameSource = DiBag.fromTokens([promiseToken], promise => ({ snapshot: () => ({ value: { present: true as const, value: promise }, metadata: { present: true as const, value: 'frame' }, alias: null }) }));
const framed = fromValBox(frameSource);
const frameBag = DiBag.begin().install(DiBag.module().add({ framed }).exports(['framed'])).bind(promiseToken, () => promised).end();
const frameInspection = frameBag.inspect('framed');
type Frames = [Assert<Equal<ProviderOutput<typeof framed>, Promise<number>>>, Assert<Equal<typeof frameInspection.acquisitions[number]['metadata'], FramePresenceTuple<ProviderAcquisitionMetadata<typeof framed>>>>];
const framedKey = Symbol('framed'); const framedToken = DiBag.token(framedKey).of<Promise<number>>();
const boundFrames = DiBag.begin().install(DiBag.module().bind(framedToken, framed).exports([framedToken]))
  .bind(promiseToken, () => promised).end().inspect(framedToken);
type BoundFrames = Assert<Equal<typeof boundFrames.acquisitions[number]['metadata'], FramePresenceTuple<ProviderAcquisitionMetadata<typeof framed>>>>;
const tokenOverride = DiBag.fromTokens([promiseToken], promise => ({ value: 2, rich: true as const }));
const child = bag.fork([token], { [key]: tokenOverride });
type Child = Assert<Equal<ReturnType<typeof child.resolve<typeof token>>, { value: number; rich: true }>>;
void [plainModule, plainProvider];
