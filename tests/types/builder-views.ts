import { DiBag } from '../../src';
import type { Assert, Equal } from './assert';

const registrations = {
  value: () => 1,
  read: ({ value }: { value: number }) => value.toFixed(),
};
const original = DiBag.begin().add(registrations);
const same: typeof original = DiBag.begin().add(registrations);
const individual: typeof original = DiBag.begin()
  .add({ value: registrations.value }).add({ read: registrations.read });
const identity = <B,>(builder: B): B => builder;
const retained: typeof original = identity(original);
const result = retained.add({ extra: async () => true }).end();
const text = result.resolve('read');
const promised = result.resolve('extra');
type Exact = [
  Assert<Equal<typeof text, string>>,
  Assert<Equal<typeof promised, Promise<boolean>>>,
];
void [same, individual];
