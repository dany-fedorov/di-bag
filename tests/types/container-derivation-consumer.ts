import { child, emptyChild, emptyIndependent, external, inline } from './container-derivation';
const a: number = emptyChild.resolve('value');
const b: number = emptyIndependent.resolve('value');
const c: number = external.resolve('value');
const d: 7 | number = inline.resolve('clock').now();
const e = child.resolve('value');
void a; void b; void c; void d; void e;
