export interface Provider<Factory> { readonly __factory?: Factory }
export interface Token<Service> { readonly key: symbol; readonly __service?: Service }
type Factory = (dependencies: never) => unknown;
type Registration = Factory | Provider<Factory>;
interface Builder {
  register(token: Token<unknown>, provider: () => unknown): Builder;
  register(providers: Record<string, Registration>): Builder;
  build(): unknown;
}
export interface DiBagApi {
  token(symbol: symbol): { of<Service>(): Token<Service> };
  createBuilder(): Builder;
  fromFactory<FactoryType extends Factory>(factory: FactoryType): Provider<FactoryType>;
  fromFunction<Service, Output>(tokens: readonly [Token<Service>], factory: (value: Service) => Output): Provider<() => Output>;
  fromClass<Service, Instance>(tokens: readonly [Token<Service>], serviceClass: new (value: Service) => Instance): Provider<() => Instance>;
  withConfiguration(options: object): DiBagApi;
  withDisposal<FactoryType extends Factory>(provider: FactoryType | Provider<FactoryType>, dispose: (value: Awaited<ReturnType<FactoryType>>) => void | Promise<void>): Provider<FactoryType>;
  withLifetime<FactoryType extends Factory>(provider: FactoryType | Provider<FactoryType>, lifetime: 'root' | 'scoped' | 'transient', options?: { readonly allowScopedDependencies?: boolean }): Provider<FactoryType>;
}
export const DiBag: DiBagApi;
