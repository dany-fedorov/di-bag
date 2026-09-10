import { expect, test } from 'bun:test';
import { matchDiagnosticMarkers } from './diagnostic-markers';

const source = '// diagnostic: consumer dependency\n// diagnostic-also: TS2684 required service registrations are missing\ncall();\n// diagnostic: next rejection\ncall();';
const primary = { file: '/fixture.ts', line: 3, code: 2345, message: 'consumer dependency' };
const supplemental = { file: '/fixture.ts', line: 3, code: 2684, message: 'required service registrations are missing' };
const next = { file: '/fixture.ts', line: 5, code: 2345, message: 'next rejection' };
test('strict matcher accounts for explicit supplemental diagnostics without splitting regions', () => {
  expect(matchDiagnosticMarkers(source, '/fixture.ts', [primary, supplemental, next])).toMatchObject({
    expected: 3, matched: 3, primaryExpected: 2, primaryMatched: 2, supplementalExpected: 1, supplementalMatched: 1, unexpected: [], missing: [],
  });
});
test('supplement cannot replace a missing primary', () => {
  expect(matchDiagnosticMarkers(source, '/fixture.ts', [supplemental, next])).toMatchObject({ expected: 3, matched: 2, primaryMatched: 1 });
});
for (const change of [{ code: 2345 }, { file: '/other.ts' }, { line: 5 }, { code: 2589 }, { message: 'unrelated' }]) {
  test(`supplement rejects ${JSON.stringify(change)}`, () => {
    const result = matchDiagnosticMarkers(source, '/fixture.ts', [primary, { ...supplemental, ...change }, next]);
    expect(result.matched).toBe(2); expect(result.unexpected).toHaveLength(1); expect(result.missing).toHaveLength(1);
  });
}
test('unrelated cascades and TS2589 remain unexpected', () => {
  const result = matchDiagnosticMarkers(source, '/fixture.ts', [primary, supplemental, next, { ...primary, message: 'unrelated' }, { ...primary, code: 2589 }]);
  expect(result.matched).toBe(3); expect(result.unexpected).toHaveLength(2);
});
