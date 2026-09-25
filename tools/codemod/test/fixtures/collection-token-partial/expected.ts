import { DiBag } from 'di-bag';

declare const chooseUser: boolean;
const uncertainKey = Symbol('uncertain');
const uncertain = DiBag.createToken(uncertainKey).forService<number>();
const receiver = chooseUser
  ? DiBag.createBuilder()
  : { userKind: 'user-builder' as const, contribute(_token: unknown, _provider: () => number) { return this; } };
export const unchangedUse = receiver.contribute(uncertain, () => 1);

const factoryKey = Symbol('factory');
const tokenFactory = chooseUser
  ? DiBag.createToken(factoryKey)
  : { userKind: 'user-token' as const, of<T>() { return undefined as T; } };
export const unchangedCreation = tokenFactory.of<number>();
