import { DiBag } from '../../src';
import type { Assert, Equal } from './assert';

const registrations = {
  value: () => 1,
  read: ({ value }: { value: number }) => value.toFixed(),
};
const original = DiBag.createBuilder().register(registrations);
const same: typeof original = DiBag.createBuilder().register(registrations);
const individual: typeof original = DiBag.createBuilder().register({ value: registrations.value }).register({ read: registrations.read });
const identity = <B,>(builder: B): B => builder;
const retained: typeof original = identity(original);
const result = retained.register({ extra: async () => true }).build();
const text = result.resolve('read');
const promised = result.resolve('extra');
type Exact = [
  Assert<Equal<typeof text, string>>,
  Assert<Equal<typeof promised, Promise<boolean>>>,
];
void [same, individual];
