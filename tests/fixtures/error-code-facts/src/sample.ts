// Fixture tree for tests/error-code-facts.test.ts: a miniature repository that the script reads as text.
declare function libraryError(code: string, message: string): Error;
/** Raises `DI_BAG_SAMPLE` for a bad sample. */
export const failure = libraryError('DI_BAG_SAMPLE', 'sample is malformed');
export const longer = libraryError('DI_BAG_SAMPLES_ARE_LONGER', 'a longer code that shares the prefix');
