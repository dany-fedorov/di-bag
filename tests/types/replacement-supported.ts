import { DiBag } from '../../src';
import type { Assert, Equal } from './assert';
const key = Symbol('service'); const token = DiBag.token(key).of<{ value: number }>();
const named = DiBag.createBuilder().register({ named: () => 1 });
const tokenBuilder = DiBag.createBuilder().register(token, () => ({ value: 1 }));
const namedModule = DiBag.createBuilder().register({ named: () => 1 });
const tokenModule = DiBag.createBuilder().register(token, () => ({ value: 1 }));
type NamedFactory = () => { read(): number; extra: true };
type TokenFactory = () => { value: number; extra: true };
const namedFactory: NamedFactory = () => ({ read: () => 1, extra: true });
const tokenFactory: TokenFactory = () => ({ value: 2, extra: true });
const namedValue = named.replace<'named', NamedFactory>('named', namedFactory).build().resolve('named');
const tokenValue = tokenBuilder.replace<typeof token, TokenFactory>(token, tokenFactory).build().resolve(token);
const namedFeature = namedModule.replace<'named', NamedFactory>('named', namedFactory).buildModule(['named']);
const tokenFeature = tokenModule.replace<typeof token, TokenFactory>(token, tokenFactory).buildModule([token]);
const namedModuleValue = DiBag.createBuilder().installModule(namedFeature).build().resolve('named');
const tokenModuleValue = DiBag.createBuilder().installModule(tokenFeature).build().resolve(token);
type Exact = [Assert<Equal<typeof namedValue, ReturnType<NamedFactory>>>, Assert<Equal<typeof tokenValue, ReturnType<TokenFactory>>>,
  Assert<Equal<typeof namedModuleValue, ReturnType<NamedFactory>>>, Assert<Equal<typeof tokenModuleValue, ReturnType<TokenFactory>>>];
export const inferredNamed = () => named.replace('named', namedFactory);
export const inferredToken = () => tokenBuilder.replace(token, tokenFactory);
export const inferredNamedModule = () => namedModule.replace('named', namedFactory);
export const inferredTokenModule = () => tokenModule.replace(token, tokenFactory);
export function forwardNamed(factory: NamedFactory) { return named.replace('named', factory); }
export function forwardToken(factory: TokenFactory) { return tokenBuilder.replace(token, factory); }
export function forwardNamedModule(factory: NamedFactory) { return namedModule.replace('named', factory); }
export function forwardTokenModule(factory: TokenFactory) { return tokenModule.replace(token, factory); }
type IsAny<T> = 0 extends (1 & T) ? true : false;
export function explicitNamed(factory: NamedFactory) { return named.replace<'named', NamedFactory>('named', factory); }
export function explicitToken(factory: TokenFactory) { return tokenBuilder.replace<typeof token, TokenFactory>(token, factory); }
export function explicitNamedModule(factory: NamedFactory) { return namedModule.replace<'named', NamedFactory>('named', factory); }
export function explicitTokenModule(factory: TokenFactory) { return tokenModule.replace<typeof token, TokenFactory>(token, factory); }
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
  Assert<Equal<IsAny<ReturnType<typeof named.replace>>, false>>,
  Assert<Equal<IsAny<ReturnType<typeof tokenBuilder.replace>>, false>>,
  Assert<Equal<IsAny<ReturnType<typeof namedModule.replace>>, false>>,
  Assert<Equal<IsAny<ReturnType<typeof tokenModule.replace>>, false>>,
];

const dependentModule = DiBag.createBuilder().register({
  value: () => 1,
  consumer: ({ value }: { value: number }) => value + 1,
});
type DependentModuleView = ReturnType<typeof dependentModule.replace>;
const reflectedFeature = dependentModule.buildModule(['value', 'consumer']);
const reflectedBag = DiBag.createBuilder().installModule(reflectedFeature).build();
const reflectedValue = reflectedBag.resolve('value');
const reflectedConsumer = reflectedBag.resolve('consumer');
type ReflectedModuleKeepsNamedHistory = [
  Assert<Equal<IsAny<DependentModuleView>, false>>,
  Assert<Equal<typeof reflectedValue, number>>,
  Assert<Equal<typeof reflectedConsumer, number>>,
];
