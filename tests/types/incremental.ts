import {
  DiBag,
  type ProviderAcquisitionMetadata,
  type ProviderRegistrationMetadata,
  type TokenDependencyContract,
} from '../../src';
import type { ProviderGraphContract } from '../../src/provider';
import type { Assert, Equal } from './assert';

const forward = DiBag.createBuilder().register({ read: ({ value }: { value: number }) => value }).register({ value: () => 1 }).build();
const forwardValue = forward.resolve('read');
type Forward = Assert<Equal<typeof forwardValue, number>>;

const key = Symbol('service');
const token = DiBag.token(key).of<{ value: number }>();
const same = DiBag.token(key).of<{ value: number }>();
const initial = DiBag.createBuilder().register({ read: DiBag.fromFunction([same], value => value.value) }).register(token, () => ({ value: 1, original: true as const }));
const replaced = initial.replace(token, () => ({ value: 2, richer: true as const })).build();
const actual = replaced.resolve(token);
type Rich = Assert<Equal<typeof actual, { value: number; richer: true }>>;

const feature = DiBag.createModuleBuilder().register({ hidden: ({ external }: { external: number }) => external }).buildModule([]);
DiBag.createBuilder().installModule(feature).register({ external: () => 1 }).replace('external', () => 2).build();

const frameSource = DiBag.withMetadata(DiBag.fromFunction([token], value => Promise.resolve(value.value)), { static: { owner: 'fixture' as const } });
const framed = DiBag.withMetadata(frameSource, { dynamic: { mode: 'direct', describe: () => ({ stage: 'framed' as const }) } });
const framedBag = DiBag.createBuilder().register({ framed }).register(token, () => ({ value: 1 })).replace('framed', framed).build();
const framedValue = framedBag.resolve('framed');
const inspection = framedBag.inspect('framed');
type Frames = [Assert<Equal<typeof framedValue, Promise<number>>>,
  Assert<Equal<ProviderGraphContract<typeof framed>, TokenDependencyContract<readonly [typeof token]>>>,
  Assert<Equal<typeof inspection.registrationMetadata, ProviderRegistrationMetadata<typeof framed>>>,
  Assert<Equal<ProviderAcquisitionMetadata<typeof framed>, readonly [Readonly<{ stage: 'framed' }>]>>];

const numberFactory = () => 2;
DiBag.createBuilder().register({ value: () => 1 }).replace<'value', typeof numberFactory>('value', numberFactory).build();
