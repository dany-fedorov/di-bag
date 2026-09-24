// Fixture for tests/error-code-inventory.test.ts: DI_BAG_INVALID_ARGUMENT must carry operation, argument and expected.
declare function libraryError(code: string, message: string, details?: object): Error;

export function complete(operation: string) {
  return libraryError('DI_BAG_INVALID_ARGUMENT', `${operation} options must be an object`, {
    operation,
    argument: 'options',
    expected: 'an object',
  });
}
export const missingExpected = libraryError('DI_BAG_INVALID_ARGUMENT', 'close waitTimeoutMs must be a number', { operation: 'close', argument: 'waitTimeoutMs' });
export const wordOnlyInMessage = libraryError('DI_BAG_INVALID_ARGUMENT', 'resolve expected one argument', { operation: 'resolve' });
export const wordsInValues = libraryError('DI_BAG_INVALID_ARGUMENT', 'close options are invalid', { operation: 'close', note: 'argument expected' });
