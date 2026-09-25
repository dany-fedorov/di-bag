type Factory = (dependencies: never) => unknown;
type Registration = Factory | Provider<Factory>;

export interface Provider<FactoryType extends Factory> { readonly __factory?: FactoryType }
interface Builder {
  withServices(providers: Record<string, Registration>): Builder;
  buildContainer(): unknown;
}
export interface DiBagApi {
  createBuilder(): Builder;
  providerWithDisposal<FactoryType extends Factory>(options: { provider: FactoryType | Provider<FactoryType>; disposeService(value: Awaited<ReturnType<FactoryType>>): void | Promise<void> }): Provider<FactoryType>;
  providerWithLifetime<FactoryType extends Factory>(options: { provider: FactoryType | Provider<FactoryType>; lifetime: string }): Provider<FactoryType>;
}
export const DiBag: DiBagApi;
