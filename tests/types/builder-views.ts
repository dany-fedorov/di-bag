import { DiBag } from '../../src';
import type { Assert, Equal } from './assert';

const registrations = {
  value: () => 1,
  read: ({ value }: { value: number }) => value.toFixed(),
};
const original = DiBag.createBuilder().withServices(registrations);
const same: typeof original = DiBag.createBuilder().withServices(registrations);
const individual: typeof original = DiBag.createBuilder().withServices({ value: registrations.value }).withServices({ read: registrations.read });
const identity = <B,>(builder: B): B => builder;
const retained: typeof original = identity(original);
const result = retained.withServices({ extra: async () => true }).buildContainer();
const text = result.resolve('read');
const promised = result.resolve('extra');
type Exact = [
  Assert<Equal<typeof text, string>>,
  Assert<Equal<typeof promised, Promise<boolean>>>,
];
void [same, individual];
