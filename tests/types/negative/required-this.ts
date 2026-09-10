import { DiBag } from '../../../src';
// diagnostic: The 'this' types of each signature are incompatible
DiBag.createBuilder().register({ value: function(this: { value: number }) { return this.value; } });
// diagnostic: The 'this' types of each signature are incompatible
DiBag.withDisposal(function(this: { value: number }) { return this.value; }, () => {});
const builder = DiBag.createBuilder().register({ value: () => 1 });
// diagnostic: The 'this' types of each signature are incompatible
builder.replace('value', function(this: { value: number }) { return this.value; });
// diagnostic: Type '(this: { value: number; }) => number' is not assignable to type
builder.build().fork(['value'], { value: function(this: { value: number }) { return this.value; } });
