import { DiBag, type CanonicalLifetime, type Provider } from '../../src';

type Request = { readonly id: string };

const feature = DiBag.createBuilder().withServices({
  repository: () => ({ read: () => 1 }),
  request: DiBag.providerWithLifetime({ provider: (): Request => ({ id: 'outside-request' }), lifetime: 'scoped:one-per-container' }),
  handler: DiBag.providerWithLifetime({
    provider: ({ repository, request }: { repository: { read(): number }; request: Request }) =>
      ({ run: () => `${request.id}:${repository.read()}` }),
    lifetime: 'scoped:one-per-container',
  }),
}).buildContainer();

export const child = feature.createChildContainer(
  ['request'],
  { request: (): Request => ({ id: 'request-1' }) },
);

export const independent = feature.createIndependentContainer(
  ['repository'],
  { repository: () => ({ read: () => 2 }) },
);

const permissive = DiBag.providerWithLifetime({
  provider: ({ request }: { request: Request }) => request,
  lifetime: 'singleton:one-per-container-tree',
  allowsScopedDependencies: true,
});
export const permissiveContainer = DiBag.createBuilder().withServices({
  request: DiBag.providerWithLifetime({ provider: (): Request => ({ id: 'shared-on-purpose' }), lifetime: 'scoped:one-per-container' }),
  permissive,
}).buildContainer();

const renamedModule = DiBag.createBuilder().withServices({
  api: ({ request }: { request: Request }) => request.id,
}).buildModule({ exportedServiceKeys: ['api'], moduleLabel: 'feature' })
  .withRenamedRequirement({ currentRequirementKey: 'request', newRequirementKey: 'featureRequest' });
export const installed = DiBag.createBuilder()
  .withInstalledModules([renamedModule])
  .withServices({
    featureRequest: DiBag.providerWithLifetime({ provider: (): Request => ({ id: 'module' }), lifetime: 'singleton:one-per-container-tree' }),
  })
  .buildContainer();

const aliasRoot = DiBag.createBuilder()
  .withServices({
    request: DiBag.providerWithLifetime({ provider: (): Request => ({ id: 'alias' }), lifetime: 'scoped:one-per-container' }),
  })
  .withServiceAlias({ aliasKey: 'requestAlias', targetServiceKey: 'request' })
  .buildContainer();
export const sharedChild = aliasRoot.createChildContainer({
  sharedParentServiceKeys: ['requestAlias'],
});

const bareProvider: Provider<() => number> = DiBag.createProvider(() => 7);
export const bareProviderContainer = DiBag.createBuilder().withServices({
  bare: bareProvider,
  consumer: ({ bare }: { bare: number }) => bare,
}).buildContainer();

type Registrations = typeof feature extends import('../../src').Container<infer R extends Record<string, import('../../src').ProviderOrFactory>, infer _C extends import('../../src/module-types').NeedConstraint> ? R : never;
type SharedRegistrations = typeof sharedChild extends import('../../src').Container<infer R extends Record<string, import('../../src').ProviderOrFactory>, infer _C extends import('../../src/module-types').NeedConstraint> ? R : never;
export type RepositoryLifetime = CanonicalLifetime<Registrations, 'repository'>;
export type RequestLifetime = CanonicalLifetime<Registrations, 'request'>;
export type SharedAliasLifetime = CanonicalLifetime<SharedRegistrations, 'requestAlias'>;
type BareRegistrations = typeof bareProviderContainer extends import('../../src').Container<infer R extends Record<string, import('../../src').ProviderOrFactory>, infer _C extends import('../../src/module-types').NeedConstraint> ? R : never;
export type BareProviderLifetime = CanonicalLifetime<BareRegistrations, 'bare'>;
const repositoryLifetime: RepositoryLifetime = 'singleton:one-per-container-tree';
const requestLifetime: RequestLifetime = 'scoped:one-per-container';
const sharedAliasLifetime: SharedAliasLifetime = 'scoped:one-per-container';
const bareProviderLifetime: BareProviderLifetime = 'singleton:one-per-container-tree';
void repositoryLifetime; void requestLifetime; void sharedAliasLifetime; void bareProviderLifetime;
