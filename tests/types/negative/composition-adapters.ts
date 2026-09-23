import { DiBag } from '../../../src';
const key = Symbol('port'); const port = DiBag.createToken(key).forService<number>();
class Client { constructor(readonly port: number) {} }
// diagnostic: not assignable
DiBag.createProviderFromClass({ dependencies: [], serviceClass: Client });
// diagnostic: not assignable
DiBag.createProviderFromFunction({ dependencies: [], factoryFunction: (value: number) => value });
// diagnostic: not assignable
DiBag.createProviderFromClass({ dependencies: [port], serviceClass: class { constructor(value: string) {} } });
// diagnostic: not assignable
DiBag.createProviderFromFunction({ dependencies: [port], factoryFunction: (value: string) => value });
// diagnostic: allows only 1
DiBag.createProviderFromClass({ dependencies: [port, port], serviceClass: Client });
// diagnostic: arguments must match
DiBag.createProviderFromFunction({ dependencies: [port, port], factoryFunction: (value: number) => value });
// diagnostic: arguments must match
DiBag.createProviderFromFunction({ dependencies: [port], factoryFunction: () => 1 });
// diagnostic: not assignable
DiBag.createProviderFromFunction({ dependencies: [port], factoryFunction: function (this: { value: number }, value: number) { return this.value + value; } });
// diagnostic: not assignable
DiBag.createProviderFromClass({ dependencies: [], serviceClass: () => 1 });
abstract class Abstract { constructor(value: number) {} }
class Private { private constructor() {} }
class Protected { protected constructor() {} }
// diagnostic: abstract
DiBag.createProviderFromClass({ dependencies: [port], serviceClass: Abstract });
// diagnostic: private
DiBag.createProviderFromClass({ dependencies: [], serviceClass: Private });
// diagnostic: protected
DiBag.createProviderFromClass({ dependencies: [], serviceClass: Protected });
// diagnostic: native-promise factory return kind requires a Promise output
DiBag.createProviderFromClass({ dependencies: [port], serviceClass: Client, factoryReturnKind: 'native-promise' });
// diagnostic: native-promise factory return kind requires a Promise output
DiBag.createProviderFromFunction({ dependencies: [port], factoryFunction: value => value, factoryReturnKind: 'native-promise' });
// diagnostic: not assignable
DiBag.createProviderFromFunction({ dependencies: [], factoryFunction: () => 1, factoryReturnKind: 'invalid' });
// diagnostic: not assignable
DiBag.createProviderFromClass({ dependencies: [], serviceClass: class {}, factoryReturnKind: 'invalid' });
declare const broad: readonly typeof port[];
declare const optional: readonly [typeof port?];
declare const union: readonly [] | readonly [typeof port];
// diagnostic: finite tuple
// diagnostic-also: TS2322 Target requires 1 element(s) but source may have fewer.
DiBag.createProviderFromClass({ dependencies: broad, serviceClass: Client });
// diagnostic: finite tuple
DiBag.createProviderFromFunction({ dependencies: broad, factoryFunction: (...values: number[]) => values });
// diagnostic: not assignable
DiBag.createProviderFromClass({ dependencies: optional, serviceClass: class { constructor(value?: number) {} } });
// diagnostic: finite tuple
DiBag.createProviderFromFunction({ dependencies: union, factoryFunction: (value?: number) => value });
// diagnostic: known properties
// diagnostic-also: TS2322 Target requires 1 element(s) but source may have fewer.
DiBag.createProviderFromClass({ dependencies: [{ key }], serviceClass: Client });
// diagnostic: known properties
DiBag.createProviderFromFunction({ dependencies: [{ key }], factoryFunction: value => value });
// diagnostic: required service registrations are missing
DiBag.createBuilder().withServices({ source: DiBag.createProviderFromClass({ dependencies: [port], serviceClass: Client }) }).buildContainer();
// diagnostic: required service registrations are missing
DiBag.createBuilder().withServices({ source: DiBag.createProviderFromFunction({ dependencies: [port], factoryFunction: value => value }) }).buildContainer();
const conflict = DiBag.createToken(key).forService<string>();
// diagnostic: incompatible
DiBag.createBuilder().withTokenService(conflict, () => 'wrong').withServices({ source: DiBag.createProviderFromClass({ dependencies: [port], serviceClass: Client }) });
// diagnostic: not assignable
DiBag.createProviderFromFunction({ dependencies: [port], factoryFunction: (first: number, ...rest: [number, ...number[]]) => rest });
// diagnostic: not assignable
DiBag.createProviderFromClass({ dependencies: [port], serviceClass: class { constructor(first: number, ...rest: [number, ...number[]]) {} } });
// diagnostic: not assignable
DiBag.createProviderFromFunction({ dependencies: [port, port], factoryFunction: (first?: number) => first });
// diagnostic: not assignable
DiBag.createProviderFromClass({ dependencies: [port, port], serviceClass: class { constructor(first?: number) {} } });
declare const mode: 'uninspected' | 'native-promise';
// diagnostic: native-promise factory return kind requires a Promise output
DiBag.createProviderFromFunction({ dependencies: [port], factoryFunction: value => value, factoryReturnKind: mode });
// diagnostic: native-promise factory return kind requires a Promise output
DiBag.createProviderFromClass({ dependencies: [port], serviceClass: Client, factoryReturnKind: mode });
