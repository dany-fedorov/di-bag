import { DiBag } from '../../src';
import type { Assert, Equal } from './assert';

const before = DiBag.begin().add({
  value: () => 1,
  read: ({ value }: { value: number }) => value.toFixed(),
});

export const changed = before
  .replace('read', () => true)
  .replace('value', () => 'new');
export const synchronous = changed.end().resolve('value');

export type ProjectionCompatibility = Assert<Equal<typeof synchronous, string>>;
