export interface Provider<Factory> { readonly __factory?: Factory }
type Factory = (dependencies: never) => unknown;
type Registration = Factory | Provider<Factory>;
interface Builder {
  withServices(providers: Record<string, Registration>): Builder;
  buildContainer(): unknown;
}
export interface DiBagApi {
  createBuilder(): Builder;
  withConfiguration(options: object): DiBagApi;
  withDisposal<FactoryType extends Factory>(provider: FactoryType | Provider<FactoryType>, dispose: (value: Awaited<ReturnType<FactoryType>>) => void | Promise<void>): Provider<FactoryType>;
  withLifetime<FactoryType extends Factory>(provider: FactoryType | Provider<FactoryType>, lifetime: 'root' | 'scoped' | 'transient'): Provider<FactoryType>;
}
export const DiBag: DiBagApi;
