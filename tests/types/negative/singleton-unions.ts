import { DiBag } from '../../../src';

const scoped = DiBag.providerWithLifetime({ provider: () => 1, lifetime: 'scoped:one-per-container' });
const strictRoot = DiBag.providerWithLifetime({ provider: ({ scoped }: { scoped: number }) => scoped, lifetime: 'singleton:one-per-container-tree' });
const scopedRoot = DiBag.providerWithLifetime({ provider: ({ scoped }: { scoped: number }) => scoped, lifetime: 'scoped:one-per-container' });
const wrappedRoot = DiBag.providerWithRegistrationMetadata({ provider: Math.random() ? strictRoot : scopedRoot, registrationMetadata: { tag: 'root' } });
// diagnostic: root lifetime cannot capture scoped dependency
DiBag.createBuilder().withServices({ scoped, root: wrappedRoot }).buildContainer();

const singletonDependency = DiBag.providerWithLifetime({ provider: () => 2, lifetime: 'singleton:one-per-container-tree' });
const wrappedDependency = DiBag.providerWithRegistrationMetadata({ provider: Math.random() ? singletonDependency : scoped, registrationMetadata: { tag: 'dependency' } });
// diagnostic: root lifetime cannot capture scoped dependency
DiBag.createBuilder().withServices({ dependency: wrappedDependency, root: ({ dependency }: { dependency: number }) => dependency }).buildContainer();

const transientBridge = DiBag.providerWithLifetime({ provider: ({ scoped }: { scoped: number }) => scoped, lifetime: 'transient:one-per-resolve' });
const permissiveBridge = DiBag.providerWithLifetime({ provider: ({ scoped }: { scoped: number }) => scoped, lifetime: 'singleton:one-per-container-tree', allowsScopedDependencies: true });
const wrappedBridge = DiBag.providerWithRegistrationMetadata({ provider: Math.random() ? transientBridge : permissiveBridge, registrationMetadata: { tag: 'bridge' } });
// diagnostic: root lifetime cannot capture scoped dependency
DiBag.createBuilder().withServices({ scoped, bridge: wrappedBridge, root: ({ bridge }: { bridge: number }) => bridge }).buildContainer();

const permissiveRoot = DiBag.providerWithLifetime({ provider: ({ scoped }: { scoped: number }) => scoped, lifetime: 'singleton:one-per-container-tree', allowsScopedDependencies: true });
const wrappedPermission = DiBag.providerWithRegistrationMetadata({ provider: Math.random() ? permissiveRoot : strictRoot, registrationMetadata: { tag: 'permission' } });
// diagnostic: root lifetime cannot capture scoped dependency
DiBag.createBuilder().withServices({ scoped, root: wrappedPermission }).buildContainer();

const numbersKey = Symbol('numbers');
const numbers = DiBag.createToken(numbersKey).forCollectionOf<number>();
const wrappedContribution = DiBag.providerWithRegistrationMetadata({ provider: Math.random() ? strictRoot : scopedRoot, registrationMetadata: { tag: 'contribution' } });
// diagnostic: root lifetime cannot capture scoped dependency
DiBag.createBuilder().withServices({ scoped }).withCollectionContribution({ collectionToken: numbers, provider: wrappedContribution }).buildContainer();

const wrappedSelection = DiBag.providerWithRegistrationMetadata({ provider: Math.random() ? singletonDependency : scoped, registrationMetadata: { tag: 'selection' } });
const container = DiBag.createBuilder().withServices({ value: wrappedSelection }).buildContainer();
container.createChildContainer(
  ['value'],
  // diagnostic: createChildContainer cannot replace singleton service: value
  { value: () => 3 },
);
