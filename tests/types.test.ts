import { expect, test } from 'bun:test';
import { readdirSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import ts from 'typescript';
import { diagnostics } from './compiler';

test('typed provider metadata survives checked composition and inspection', () => {
  expect(diagnostics(resolve(__dirname, 'types/providers.ts')).map(error =>
    ts.flattenDiagnosticMessageText(error.messageText, '\n'))).toEqual([]);
});

test('named modules preserve contracts across a file boundary', () => {
  expect(diagnostics(resolve(__dirname, 'types/modules/consumer.ts')).map(error =>
    ts.flattenDiagnosticMessageText(error.messageText, '\n'))).toEqual([]);
});

test('valid composition preserves inferred values and explicit promise edges', () => {
  const errors = diagnostics(resolve(__dirname, 'types/positive.ts'));
  expect(
    errors.map((error) =>
      ts.flattenDiagnosticMessageText(error.messageText, '\n'),
    ),
  ).toEqual([]);
});

test('registration boundaries preserve selected keys and exact factory types', () => {
  const errors = diagnostics(resolve(__dirname, 'types/boundaries.ts'));
  expect(
    errors.map(error => ts.flattenDiagnosticMessageText(error.messageText, '\n')),
  ).toEqual([]);
});

for (const operation of ['add', 'fork', 'disposal']) {
  test(`inline method-returning factories preserve exact types: ${operation}`, () => {
    const errors = diagnostics(
      resolve(__dirname, `types/inline-${operation}.ts`),
    );
    expect(
      errors.map((error) =>
        ts.flattenDiagnosticMessageText(error.messageText, '\n'),
      ),
    ).toEqual([]);
  });
}

for (const name of readdirSync(resolve(__dirname, 'types/negative')).filter(
  (name) => name.endsWith('.ts'),
)) {
  test(`type rejection: ${name}`, () => {
    const path = resolve(__dirname, 'types/negative', name);
    const source = readFileSync(path, 'utf8');
    const expected = [...source.matchAll(/\/\/ diagnostic: (.+)/g)];
    expect(expected.length).toBeGreaterThan(0);
    const errors = diagnostics(path);
    expect(errors.length).toBeGreaterThan(0);
    expect(errors.every((error) => error.file?.fileName === path)).toBe(true);
    for (const [index, marker] of expected.entries()) {
      const end = expected[index + 1]?.index ?? source.length;
      const messages = errors
        .filter(error =>
          error.start !== undefined && error.start >= marker.index && error.start < end,
        )
        .map(error => ts.flattenDiagnosticMessageText(error.messageText, '\n'))
        .join('\n');
      expect(messages).toContain(marker[1]!);
    }
  });
}
