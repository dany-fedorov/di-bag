import { afterEach, expect, test } from 'bun:test';
import { describeDiagnostic, diagnostics, namedModuleScaleSource, resetCompilerState, scalePath, scaleSource } from './compiler';
import type { ScaleForm } from './compiler';

afterEach(() => {
  resetCompilerState();
  Bun.gc(true);
});

for (const [count, form] of [[100, 'bulk'], [100, 'chained'], [100, 'replacement'], [1000, 'grouped']] as const) {
  test(`type scale: ${count} ${form} providers preserve consumer types`, () => {
    const errors = diagnostics(scalePath, scaleSource(count, form));
    expect(errors.map(describeDiagnostic)).toEqual([]);
  }, 120_000);
}

for (const form of ['bulk', 'chained', 'grouped', 'replacement'] satisfies ScaleForm[]) {
  for (const [scenario, message] of [['missing', 'required service registrations are missing'], ['wrong-shape', 'provided service does not satisfy its consumer dependency']] as const) {
    test(`type scale: ${form} rejects ${scenario} at the graph boundary`, () => {
      const errors = diagnostics(scalePath, scaleSource(form === 'grouped' ? 1000 : 100, form, scenario)).map(describeDiagnostic);
      expect(errors.length).toBeGreaterThan(0);
      expect(errors.every(error => error.file === scalePath && error.line !== undefined && error.column !== undefined)).toBe(true);
      expect(errors.some(error => error.code === 2589)).toBe(false);
      expect(errors.some(error => error.message.includes(message))).toBe(true);
    }, 120_000);
  }
}

for (const scenario of ['valid', 'missing', 'wrong-shape'] as const) {
  test(`type scale: 1000 providers from reusable named modules: ${scenario}`, () => {
    const errors = diagnostics(scalePath, namedModuleScaleSource(1000, scenario)).map(describeDiagnostic);
    if (scenario === 'valid') expect(errors).toEqual([]);
    else {
      expect(errors.length).toBeGreaterThan(0);
      expect(errors.every(error => error.file === scalePath && error.line !== undefined && error.column !== undefined)).toBe(true);
      expect(errors.some(error => error.code === 2589)).toBe(false);
      expect(errors.some(error => error.message.includes(scenario === 'missing' ? 'required service registrations are missing' : 'provided service does not satisfy its consumer dependency'))).toBe(true);
    }
  }, 120_000);
}
