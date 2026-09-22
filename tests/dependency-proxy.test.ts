import { expect, test } from 'bun:test';
import { DiBag } from '../src';

type Logger = { log(message: string): void };

test('destructuring, direct reads, and positional adapters keep working', async () => {
  const key = Symbol('logger');
  const loggerToken = DiBag.token(key).of<Logger>();
  const bag = DiBag.createBuilder()
    .withTokenService(loggerToken, () => ({ log() {} }))
    .withServices({
      logger: (): Logger => ({ log() {} }),
      direct: (deps: { logger: Logger }) => typeof deps.logger.log,
      destructured: ({ logger }: { logger: Logger }) => typeof logger.log,
      positional: DiBag.fromFunction([loggerToken], logger => typeof logger.log),
    })
    .buildContainer();
  expect(bag.resolve('direct')).toBe('function');
  expect(bag.resolve('destructured')).toBe('function');
  expect(bag.resolve('positional')).toBe('function');
  await bag.close();
});

const accesses: ReadonlyArray<readonly [string, (deps: object) => unknown, string]> = [
  ["the 'in' operator", deps => 'logger' in deps, "'logger' in deps"],
  ['Object.keys', deps => Object.keys(deps), 'enumeration'],
  ['spread', deps => ({ ...deps }), 'enumeration'],
  ['JSON.stringify', deps => JSON.stringify(deps), 'JSON.stringify'],
  ['Object.getOwnPropertyDescriptor', deps => Object.getOwnPropertyDescriptor(deps, 'logger'), "descriptor of 'logger'"],
];

for (const [name, access, fragment] of accesses) test(`${name} on the dependency object throws DI_BAG_INVALID_DEPENDENCY_ACCESS`, async () => {
  let calls = 0;
  const bag = DiBag.createBuilder().withServices({
    logger: (): Logger => ({ log() {} }),
    probe: (deps: { logger: Logger }) => { calls++; return access(deps); },
  }).buildContainer();
  let caught: unknown;
  try { bag.resolve('probe'); } catch (error) { caught = error; }
  expect(caught).toBeInstanceOf(Error);
  const { code, details, message } = caught as Error & { code: string; details: Record<string, unknown> };
  expect(code).toBe('DI_BAG_INVALID_DEPENDENCY_ACCESS');
  expect(details.consumer).toBe('probe');
  expect(details.operation).toBe('resolve');
  expect(message).toContain('"probe"');
  expect(message).toContain(fragment);
  // The failed attempt is evicted: a corrected factory would run again on the next resolve.
  expect(calls).toBe(1);
  expect(bag.serviceSnapshot('probe').acquisitions).toEqual([]);
  await bag.close();
});

test('enumeration inside a fork override is rejected the same way', async () => {
  const root = DiBag.createBuilder().withServices({ value: () => 1, reader: ({ value }: { value: number }) => value }).buildContainer();
  const fork = root.createIndependentContainer(['reader'], { reader: (deps: { value: number }) => Object.keys(deps).length });
  expect(() => fork.resolve('reader')).toThrow('enumeration (Object.keys, spread, JSON.stringify) is not supported');
  await fork.close();
  await root.close();
});
