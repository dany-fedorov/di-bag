import { DiBag } from '../../../src';
const builder = DiBag.createBuilder().withServices({ a: () => 1, b: () => 2 });
declare const union: 'a' | 'b';
declare const widened: string;
declare const template: `a${string}`;
// diagnostic: replace requires one existing singleton string-literal key
builder.withReplacedService(union, () => 'wrong');
// diagnostic: replace requires one existing singleton string-literal key
builder.withReplacedService(widened, () => 3);
// diagnostic: replace requires one existing singleton string-literal key
builder.withReplacedService(template, () => 3);
// diagnostic: replace requires one existing singleton string-literal key
builder.withReplacedService('unknown', () => 3);
