import { expect, test } from 'bun:test';
import { describeDiagnostic, diagnostics, scalePath, scaleSource } from './compiler';
import type { ScaleForm } from './compiler';

for (const [count, form] of [[100, 'bulk'], [100, 'chained'], [100, 'replacement'], [1000, 'grouped']] as const) {
  test(`type scale: ${count} ${form} providers preserve consumer types`, () => {
    const errors = diagnostics(scalePath, scaleSource(count, form));
    expect(errors.map(describeDiagnostic)).toEqual([]);
  }, 120_000);
}

for (const form of ['bulk', 'chained', 'grouped', 'replacement'] satisfies ScaleForm[]) {
  for (const [scenario, message] of [['missing', 'missing factories'], ['wrong-shape', 'a dependency has the wrong shape']] as const) {
    test(`type scale: ${form} rejects ${scenario} at the graph boundary`, () => {
      const errors = diagnostics(scalePath, scaleSource(form === 'grouped' ? 1000 : 100, form, scenario)).map(describeDiagnostic);
      expect(errors.length).toBeGreaterThan(0);
      expect(errors.every(error => error.file === scalePath && error.line !== undefined && error.column !== undefined)).toBe(true);
      expect(errors.some(error => error.code === 2589)).toBe(false);
      expect(errors.some(error => error.message.includes(message))).toBe(true);
    }, 120_000);
  }
}
