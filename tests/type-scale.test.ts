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

function namedModuleSource(scenario: 'valid' | 'missing' | 'wrong-shape') {
  const modules = Array.from({ length: 20 }, (_, group) => {
    const entries = Array.from({ length: 50 }, (_, offset) => {
      const index = group * 50 + offset;
      if (index === 0) return 'svc0: () => 1';
      const dependency = scenario === 'missing' && index === 950 ? 'missingFinal' : `svc${index - 1}`;
      const shape = scenario === 'wrong-shape' && index === 950 ? 'string' : 'number';
      return `svc${index}: ({ ${dependency} }: { ${dependency}: ${shape} }) => ${shape === 'string' ? `${dependency}.length` : `${dependency} + 1`}`;
    });
    const names = Array.from({ length: 50 }, (_, offset) => `'svc${group * 50 + offset}'`).join(', ');
    return `const feature${group} = DiBag.module().add({ ${entries.join(',\n')} }).exports([${names}]);`;
  });
  return `import { DiBag } from '../src';
${modules.join('\n')}
const bag = DiBag.begin()${modules.map((_, index) => `.install(feature${index})`).join('\n')}.end();
const first: number = bag.resolve('svc0');
const middle: number = bag.resolve('svc500');
const last: number = bag.resolve('svc999');
const reused = DiBag.begin().install(feature0).end();
const reusableResult: number = reused.resolve('svc49');
`;
}

for (const scenario of ['valid', 'missing', 'wrong-shape'] as const) {
  test(`type scale: 1000 providers from reusable named modules: ${scenario}`, () => {
    const errors = diagnostics(scalePath, namedModuleSource(scenario)).map(describeDiagnostic);
    if (scenario === 'valid') expect(errors).toEqual([]);
    else {
      expect(errors.length).toBeGreaterThan(0);
      expect(errors.every(error => error.file === scalePath && error.line !== undefined && error.column !== undefined)).toBe(true);
      expect(errors.some(error => error.code === 2589)).toBe(false);
      expect(errors.some(error => error.message.includes(scenario === 'missing' ? 'missing factories' : 'a dependency has the wrong shape'))).toBe(true);
    }
  }, 120_000);
}
