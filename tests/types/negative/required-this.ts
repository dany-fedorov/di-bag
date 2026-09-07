import { DiBag } from '../../../src';
// diagnostic: The 'this' types of each signature are incompatible
DiBag.begin().add({ value: function(this: { value: number }) { return this.value; } });
// diagnostic: The 'this' types of each signature are incompatible
DiBag.withDisposal(function(this: { value: number }) { return this.value; }, () => {});
const builder = DiBag.begin().add({ value: () => 1 });
// diagnostic: The 'this' types of each signature are incompatible
// diagnostic-native-gap: last-token-string
builder.replace('value', function(this: { value: number }) { return this.value; });
// diagnostic: Type '(this: { value: number; }) => number' is not assignable to type
builder.end().fork(['value'], { value: function(this: { value: number }) { return this.value; } });
