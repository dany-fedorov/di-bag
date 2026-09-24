import { bareProviderContainer, child, independent, installed, permissiveContainer } from './singleton-default';
import type { BareProviderLifetime, RepositoryLifetime, RequestLifetime, SharedAliasLifetime } from './singleton-default';

const handler: { run(): string } = child.resolve('handler');
const repository: { read(): number } = independent.resolve('repository');
const moduleValue: string = installed.resolve('api');
const request: { readonly id: string } = permissiveContainer.resolve('permissive');
const singleton: RepositoryLifetime = 'singleton:one-per-container-tree';
const scoped: RequestLifetime = 'scoped:one-per-container';
const sharedScoped: SharedAliasLifetime = 'scoped:one-per-container';
const bareValue: number = bareProviderContainer.resolve('consumer');
const bareSingleton: BareProviderLifetime = 'singleton:one-per-container-tree';
void handler; void repository; void moduleValue; void request; void singleton; void scoped; void sharedScoped; void bareValue; void bareSingleton;
