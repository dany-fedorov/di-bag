import { DiBag } from '../../../src';
const builder = DiBag.begin().add({ a: () => 1, b: () => 2 });
declare const union: 'a' | 'b';
declare const widened: string;
declare const template: `a${string}`;
// diagnostic: replace requires one existing singleton string-literal key
// diagnostic-native-gap: last-token-string-union
builder.replace(union, () => 'wrong');
// diagnostic: replace requires one existing singleton string-literal key
// diagnostic-native-gap: last-token-string
builder.replace(widened, () => 3);
// diagnostic: replace requires one existing singleton string-literal key
// diagnostic-native-gap: last-token-open-template
builder.replace(template, () => 3);
// diagnostic: replace requires one existing singleton string-literal key
// diagnostic-native-gap: last-token-string
builder.replace('unknown', () => 3);
