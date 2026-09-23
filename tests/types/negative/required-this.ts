import { DiBag } from '../../../src';
// diagnostic: The 'this' types of each signature are incompatible
DiBag.createBuilder().withServices({ value: function(this: { value: number }) { return this.value; } });
// diagnostic: The 'this' types of each signature are incompatible
DiBag.providerWithDisposal({ provider: function(this: { value: number }) { return this.value; }, disposeService: () => {} });
const builder = DiBag.createBuilder().withServices({ value: () => 1 });
// diagnostic: The 'this' types of each signature are incompatible
builder.withReplacedService('value', function(this: { value: number }) { return this.value; });
// diagnostic: Type '(this: { value: number; }) => number' is not assignable to type
builder.buildContainer().createIndependentContainer(['value'], { value: function(this: { value: number }) { return this.value; } });
