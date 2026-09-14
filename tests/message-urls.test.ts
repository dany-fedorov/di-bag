import { expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const source = (file: string) => readFileSync(resolve(__dirname, '../src', file), 'utf8');

// Compile-time messages and runtime errors must send readers to the same page.
test('the type-level errors page equals the runtime errors page', () => {
  const typeLevel = /export type ErrorsPage = '([^']+)';/.exec(source('types.ts'))?.[1];
  const runtime = /const errorsPage = '([^']+)';/.exec(source('errors.ts'))?.[1];
  expect(typeLevel).toBeDefined();
  expect(typeLevel).toBe(runtime!);
});
