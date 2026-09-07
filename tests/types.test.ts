import { expect, test } from 'bun:test';
import { readdirSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import ts from 'typescript';
import { diagnostics, describeDiagnostic } from './compiler';
import { matchDiagnosticMarkers } from './diagnostic-markers';

test('token modules preserve exact cross-file contracts', () => {
  expect(diagnostics(resolve(__dirname, 'types/token-modules/consumer.ts')).map(error =>
    ts.flattenDiagnosticMessageText(error.messageText, '\n'))).toEqual([]);
});

test('public token composition preserves exact outputs and frames', () => {
  expect(diagnostics(resolve(__dirname, 'types/tokens.ts')).map(error =>
    ts.flattenDiagnosticMessageText(error.messageText, '\n'))).toEqual([]);
});

test('token contracts preserve exact identities and provider graphs', () => {
  expect(diagnostics(resolve(__dirname, 'types/token-contracts.ts')).map(error =>
    ts.flattenDiagnosticMessageText(error.messageText, '\n'))).toEqual([]);
});

test('replacement context preserves exact contracts from surviving consumers', () => {
  expect(diagnostics(resolve(__dirname, 'types/replacement-context.ts')).map(error =>
    ts.flattenDiagnosticMessageText(error.messageText, '\n'))).toEqual([]);
});

test('incremental checks preserve forward, replacement and frame contracts', () => {
  expect(diagnostics(resolve(__dirname, 'types/incremental.ts')).map(error =>
    ts.flattenDiagnosticMessageText(error.messageText, '\n'))).toEqual([]);
});

test('builder views preserve exact accepted registration histories', () => {
  expect(diagnostics(resolve(__dirname, 'types/builder-views.ts')).map(error =>
    ts.flattenDiagnosticMessageText(error.messageText, '\n'))).toEqual([]);
});

test('supported replacement wrappers and reflected methods stay exact and non-any', () => {
  expect(diagnostics(resolve(__dirname, 'types/replacement-supported.ts')).map(error =>
    ts.flattenDiagnosticMessageText(error.messageText, '\n'))).toEqual([]);
});

test('modern inline inference retains exact contracts', () => {
  expect(diagnostics(resolve(__dirname, 'types/modern-inline-consumer.ts')).map(error =>
    ts.flattenDiagnosticMessageText(error.messageText, '\n'))).toEqual([]);
});

test('box adapters preserve exact modes, requirements and frames', () => {
  expect(diagnostics(resolve(__dirname, 'types/box-adapters.ts')).map(error =>
    ts.flattenDiagnosticMessageText(error.messageText, '\n'))).toEqual([]);
});

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
    const matched = matchDiagnosticMarkers(source, path, errors.map(describeDiagnostic));
    expect(matched.missing).toEqual([]); expect(matched.unexpected).toEqual([]);
  });
}
