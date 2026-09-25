import { DiBag } from '../../src';
import type { Assert, Equal } from './assert';
const key = Symbol('service'); const token = DiBag.createToken(key).forService<{ value: number }>();
const named = DiBag.createBuilder().withServices({ named: () => 1 });
const tokenBuilder = DiBag.createBuilder().withTokenService(token, () => ({ value: 1 }));
const namedModule = DiBag.createBuilder().withServices({ named: () => 1 });
const tokenModule = DiBag.createBuilder().withTokenService(token, () => ({ value: 1 }));
type NamedFactory = () => { read(): number; extra: true };
type TokenFactory = () => { value: number; extra: true };
const namedFactory: NamedFactory = () => ({ read: () => 1, extra: true });
const tokenFactory: TokenFactory = () => ({ value: 2, extra: true });
const namedValue = named.withReplacedService<'named', NamedFactory>('named', namedFactory).buildContainer().resolve('named');
const tokenValue = tokenBuilder.withReplacedService<typeof token, TokenFactory>(token, tokenFactory).buildContainer().resolve(token);
const namedFeature = namedModule.withReplacedService<'named', NamedFactory>('named', namedFactory).buildModule({ exportedServiceKeys: ['named'] });
const tokenFeature = tokenModule.withReplacedService<typeof token, TokenFactory>(token, tokenFactory).buildModule({ exportedServiceKeys: [token] });
const namedModuleValue = DiBag.createBuilder().withInstalledModules([namedFeature]).buildContainer().resolve('named');
const tokenModuleValue = DiBag.createBuilder().withInstalledModules([tokenFeature]).buildContainer().resolve(token);
type Exact = [Assert<Equal<typeof namedValue, ReturnType<NamedFactory>>>, Assert<Equal<typeof tokenValue, ReturnType<TokenFactory>>>,
  Assert<Equal<typeof namedModuleValue, ReturnType<NamedFactory>>>, Assert<Equal<typeof tokenModuleValue, ReturnType<TokenFactory>>>];
export const inferredNamed = () => named.withReplacedService('named', namedFactory);
export const inferredToken = () => tokenBuilder.withReplacedService(token, tokenFactory);
export const inferredNamedModule = () => namedModule.withReplacedService('named', namedFactory);
export const inferredTokenModule = () => tokenModule.withReplacedService(token, tokenFactory);
export function forwardNamed(factory: NamedFactory) { return named.withReplacedService('named', factory); }
export function forwardToken(factory: TokenFactory) { return tokenBuilder.withReplacedService(token, factory); }
export function forwardNamedModule(factory: NamedFactory) { return namedModule.withReplacedService('named', factory); }
export function forwardTokenModule(factory: TokenFactory) { return tokenModule.withReplacedService(token, factory); }
type IsAny<T> = 0 extends (1 & T) ? true : false;
export function explicitNamed(factory: NamedFactory) { return named.withReplacedService<'named', NamedFactory>('named', factory); }
export function explicitToken(factory: TokenFactory) { return tokenBuilder.withReplacedService<typeof token, TokenFactory>(token, factory); }
export function explicitNamedModule(factory: NamedFactory) { return namedModule.withReplacedService<'named', NamedFactory>('named', factory); }
export function explicitTokenModule(factory: TokenFactory) { return tokenModule.withReplacedService<typeof token, TokenFactory>(token, factory); }
type ConcreteUtilities = [
  Assert<Equal<Parameters<typeof explicitNamed>, [factory: NamedFactory]>>,
  Assert<Equal<Parameters<typeof explicitToken>, [factory: TokenFactory]>>,
  Assert<Equal<ReturnType<typeof explicitNamed>, ReturnType<typeof inferredNamed>>>,
  Assert<Equal<ReturnType<typeof explicitToken>, ReturnType<typeof inferredToken>>>,
  Assert<Equal<ReturnType<typeof explicitNamedModule>, ReturnType<typeof inferredNamedModule>>>,
  Assert<Equal<ReturnType<typeof explicitTokenModule>, ReturnType<typeof inferredTokenModule>>>,
  Assert<Equal<IsAny<ReturnType<typeof explicitNamed>>, false>>,
  Assert<Equal<IsAny<ReturnType<typeof explicitToken>>, false>>,
  Assert<Equal<IsAny<ReturnType<typeof explicitNamedModule>>, false>>,
  Assert<Equal<IsAny<ReturnType<typeof explicitTokenModule>>, false>>,
  Assert<Equal<ReturnType<typeof forwardNamed>, ReturnType<typeof inferredNamed>>>,
  Assert<Equal<ReturnType<typeof forwardToken>, ReturnType<typeof inferredToken>>>,
  Assert<Equal<ReturnType<typeof forwardNamedModule>, ReturnType<typeof inferredNamedModule>>>,
  Assert<Equal<ReturnType<typeof forwardTokenModule>, ReturnType<typeof inferredTokenModule>>>,
];

type ReflectedMethodsStayChecked = [
  Assert<Equal<IsAny<ReturnType<typeof named.withReplacedService>>, false>>,
  Assert<Equal<IsAny<ReturnType<typeof tokenBuilder.withReplacedService>>, false>>,
  Assert<Equal<IsAny<ReturnType<typeof namedModule.withReplacedService>>, false>>,
  Assert<Equal<IsAny<ReturnType<typeof tokenModule.withReplacedService>>, false>>,
];

const dependentModule = DiBag.createBuilder().withServices({
  value: () => 1,
  consumer: ({ value }: { value: number }) => value + 1,
});
type DependentModuleView = ReturnType<typeof dependentModule.withReplacedService>;
const reflectedFeature = dependentModule.buildModule({ exportedServiceKeys: ['value', 'consumer'] });
const reflectedBag = DiBag.createBuilder().withInstalledModules([reflectedFeature]).buildContainer();
const reflectedValue = reflectedBag.resolve('value');
const reflectedConsumer = reflectedBag.resolve('consumer');
type ReflectedModuleKeepsNamedHistory = [
  Assert<Equal<IsAny<DependentModuleView>, false>>,
  Assert<Equal<typeof reflectedValue, number>>,
  Assert<Equal<typeof reflectedConsumer, number>>,
];
