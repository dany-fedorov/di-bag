// Fixture for tests/error-code-inventory.test.ts. It compiles, but nothing runs it: the script reads it as text.
declare function libraryError(code: string, message: string, details?: object): Error;
declare function snapshotOptions(value: unknown, operation: string, code: string, supported: readonly string[]): object | undefined;

/** Raises 'DI_BAG_IN_JSDOC' when things go wrong. */
export class Sample extends Error { declare readonly code: 'DI_BAG_DECLARED'; }
function assertOpen(state: string) {
  if (state !== 'open') throw libraryError(state === 'closing' ? 'DI_BAG_CLOSING' : 'DI_BAG_CLOSED', `bag is ${state}`, { state });
}
function options(value: unknown) {
  const selected = snapshotOptions(value, 'close', 'DI_BAG_SAMPLE_OPTIONS', ['signal']);
  if (selected === undefined) return;
  if (typeof value !== 'object' || value === null) throw libraryError('DI_BAG_SAMPLE_OPTIONS', 'close options must be an object', { operation: 'close' });
}
function access(label: string) {
  return libraryError(
    'DI_BAG_INVALID_DEPENDENCY_ACCESS',
    `Cannot inspect the dependencies of ${label}`,
  );
}
