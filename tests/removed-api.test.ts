import { expect, test } from 'bun:test';
import { DiBag } from '../src';
import { isRemovedApiStub, removedApi } from '../src/removed-api';

// One live object per owner in the generated table. Owners carry their 0.4.0 declaration names.
const builder = () => DiBag.createBuilder().withServices({ value: () => 1 });
const targets: Record<string, () => object> = {
  DiBagApi: () => DiBag,
  Builder: () => builder(),
  Bag: () => builder().buildContainer(),
  Module: () => builder().buildModule({ exportedServiceKeys: ['value'] }),
  'token()': () => {
    const key = Symbol('removed-api');
    return DiBag.createToken(key);
  },
};

test('every owner in the generated table has a live object here', () => {
  expect(Object.keys(removedApi).filter(owner => targets[owner] === undefined)).toEqual([]);
});

test('every removed name is a hidden stub that throws DI_BAG_REMOVED_API and names its replacement', () => {
  for (const [owner, names] of Object.entries(removedApi)) {
    const target = targets[owner]!() as Record<string, unknown>;
    for (const [name, replacement] of Object.entries(names)) {
      const member = target[name];
      // A failure here prints the name: either the stub was never installed, or a live member still has this name.
      expect(`${owner}.${name} stub=${isRemovedApiStub(member)}`).toBe(`${owner}.${name} stub=true`);
      expect(Object.keys(target)).not.toContain(name);
      let error: (Error & { code?: string; details?: unknown }) | undefined;
      try { (member as () => never)(); } catch (caught) { error = caught as Error; }
      expect(error?.code).toBe('DI_BAG_REMOVED_API');
      expect(error?.details).toEqual({ operation: name, removed: `${owner}.${name}`, replacement });
      expect(error?.message).toStartWith(`DI_BAG_REMOVED_API: ${name} was removed in 0.5.0; use ${replacement}; see `);
    }
  }
});

test('a configured facade carries the stubs too, and the live API is all that Object.keys shows', () => {
  const configured = DiBag.withConfiguration({}) as unknown as Record<string, unknown>;
  for (const name of Object.keys(removedApi.DiBagApi ?? {})) expect(`${name} stub=${isRemovedApiStub(configured[name])}`).toBe(`${name} stub=true`);
  expect(Object.keys(DiBag).filter(name => isRemovedApiStub((DiBag as unknown as Record<string, unknown>)[name]))).toEqual([]);
});
