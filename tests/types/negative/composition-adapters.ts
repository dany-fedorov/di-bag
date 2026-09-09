import { DiBag } from '../../../src';
const key = Symbol('port'); const port = DiBag.token(key).of<number>();
class Client { constructor(readonly port: number) {} }
// diagnostic: not assignable
DiBag.fromClass([], Client);
// diagnostic: not assignable
DiBag.fromFunction([], (value: number) => value);
// diagnostic: not assignable
DiBag.fromClass([port], class { constructor(value: string) {} });
// diagnostic: not assignable
DiBag.fromFunction([port], (value: string) => value);
// diagnostic: allows only 1
DiBag.fromClass([port, port], Client);
// diagnostic: arguments must match
DiBag.fromFunction([port, port], (value: number) => value);
// diagnostic: arguments must match
DiBag.fromFunction([port], () => 1);
// diagnostic: not assignable
DiBag.fromFunction([port], function (this: { value: number }, value: number) { return this.value + value; });
// diagnostic: not assignable
DiBag.fromClass([], () => 1);
abstract class Abstract { constructor(value: number) {} }
class Private { private constructor() {} }
class Protected { protected constructor() {} }
// diagnostic: abstract
DiBag.fromClass([port], Abstract);
// diagnostic: private
DiBag.fromClass([], Private);
// diagnostic: protected
DiBag.fromClass([], Protected);
// diagnostic: native acquisition requires a Promise output
DiBag.fromClass([port], Client, { acquisition: 'native' });
// diagnostic: native acquisition requires a Promise output
DiBag.fromFunction([port], value => value, { acquisition: 'native' });
// diagnostic: not assignable
DiBag.fromFunction([], () => 1, { acquisition: 'invalid' });
// diagnostic: not assignable
DiBag.fromClass([], class {}, { acquisition: 'invalid' });
declare const broad: readonly typeof port[];
declare const optional: readonly [typeof port?];
declare const union: readonly [] | readonly [typeof port];
// diagnostic: finite tuple
DiBag.fromClass(broad, Client);
// diagnostic: finite tuple
DiBag.fromFunction(broad, (...values: number[]) => values);
// diagnostic: not assignable
DiBag.fromClass(optional, class { constructor(value?: number) {} });
// diagnostic: finite tuple
DiBag.fromFunction(union, (value?: number) => value);
// diagnostic: known properties
DiBag.fromClass([{ key }], Client);
// diagnostic: known properties
DiBag.fromFunction([{ key }], value => value);
// diagnostic: missing factories
DiBag.begin().add({ source: DiBag.fromClass([port], Client) }).end();
// diagnostic: missing factories
DiBag.begin().add({ source: DiBag.fromFunction([port], value => value) }).end();
const conflict = DiBag.token(key).of<string>();
// diagnostic: incompatible
DiBag.begin().bind(conflict, () => 'wrong').add({ source: DiBag.fromClass([port], Client) });
// diagnostic: not assignable
DiBag.fromFunction([port], (first: number, ...rest: [number, ...number[]]) => rest);
// diagnostic: not assignable
DiBag.fromClass([port], class { constructor(first: number, ...rest: [number, ...number[]]) {} });
// diagnostic: not assignable
DiBag.fromFunction([port, port], (first?: number) => first);
// diagnostic: not assignable
DiBag.fromClass([port, port], class { constructor(first?: number) {} });
declare const mode: 'raw' | 'native';
// diagnostic: native acquisition requires a Promise output
DiBag.fromFunction([port], value => value, { acquisition: mode });
// diagnostic: native acquisition requires a Promise output
DiBag.fromClass([port], Client, { acquisition: mode });
