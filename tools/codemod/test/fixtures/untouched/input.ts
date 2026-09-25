import { DiBag } from 'di-bag';

class Registry {
  register(entries: Record<string, number>): this { void entries; return this; }
  alias(destination: string, target: string): this { void destination; void target; return this; }
  resolve(name: string): string { return name; }
}

export async function untouched(url: string, signal: AbortSignal, loose: any) {
  const text = 'a-b'.replace('-', '+');
  const settled = await Promise.all([Promise.resolve(1), Promise.resolve(text)]);
  const registry = new Registry().register({ one: 1 }).alias('uno', 'one');
  const response = fetch(url, { signal });
  loose.replace('x', 'y');
  loose.alias('a', 'b');
  return [settled, registry.resolve('one'), response];
}

export const bag = DiBag.createBuilder().register({ value: () => 1 }).replace('value', () => 2).build();
export const value = bag.resolve('value');
