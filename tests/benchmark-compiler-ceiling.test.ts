import { expect, test } from 'bun:test';
import { controlScaleSource, describeDiagnostic, diagnostics, namedModuleScaleSource, scalePath } from './compiler';

test('the control chain imports the library so the checker is warm, then registers count times', () => {
  const source = controlScaleSource(3);
  expect(source.startsWith("import { DiBag } from '../src';\nconst seed: unknown = DiBag;\n")).toBe(true);
  // The first call shares the `const bag = builder` line, so count dotted calls, not line starts.
  expect(source.match(/\.register\(/g)).toHaveLength(3);
  expect(source).toContain("bag.resolve('svc2')");
  expect(source).not.toContain('createBuilder');
  expect(() => controlScaleSource(0)).toThrow('control scale count must be at least one');
});

test('the control chain compiles clean', () => {
  expect(diagnostics(scalePath, controlScaleSource(5)).map(describeDiagnostic)).toEqual([]);
}, 60_000);

test('named modules hold 50 providers each and the fault sits in the last module', () => {
  const valid = namedModuleScaleSource(120);
  expect(valid.match(/^const feature\d+ = /gm)).toHaveLength(3);
  expect(valid.match(/\.installModule\(feature\d+\)/g)).toHaveLength(3);
  expect(valid).toContain("bag.resolve('svc60')");
  expect(valid).toContain("bag.resolve('svc119')");
  expect(valid).toContain("reused.resolve('svc49')");
  expect(namedModuleScaleSource(120, 'missing')).toContain('svc100: ({ missingFinal }: { missingFinal: number })');
  expect(namedModuleScaleSource(120, 'wrong-shape')).toContain('svc100: ({ svc99 }: { svc99: string })');
  expect(namedModuleScaleSource(1000, 'missing')).toContain('svc950: ({ missingFinal }');
  expect(() => namedModuleScaleSource(49)).toThrow('named module scale count must be at least 50');
  expect(() => namedModuleScaleSource(50, 'missing')).toThrow('negative named module scenarios need at least two modules');
});
