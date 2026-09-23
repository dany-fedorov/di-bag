export interface Provider<Factory> { readonly __factory?: Factory }
export interface Token<Service> { readonly key: symbol; readonly __service?: Service }
interface Builder {
  register(token: Token<unknown>, provider: () => unknown): Builder;
  register(providers: Record<string, ((dependencies: never) => unknown) | Provider<(dependencies: never) => unknown>>): Builder;
  build(): unknown;
}
export const DiBag: {
  token(symbol: symbol): { of<Service>(): Token<Service> };
  createBuilder(): Builder;
  fromFactory<Factory extends (dependencies: never) => unknown>(factory: Factory): Provider<Factory>;
  fromFunction<Service, Output>(tokens: readonly [Token<Service>], factory: (value: Service) => Output): Provider<() => Output>;
  fromClass<Service, Instance>(tokens: readonly [Token<Service>], serviceClass: new (value: Service) => Instance): Provider<() => Instance>;
};
