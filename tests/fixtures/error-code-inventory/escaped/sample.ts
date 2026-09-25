declare function libraryError(code: string, message: string, details?: object): Error;

export function escaped() {
  return libraryError('DI_BAG_SAMPLE_OPTIONS', 'line one\nline two\tcolumn', {});
}

export function multiline(name: string) {
  return libraryError('DI_BAG_SAMPLE_OPTIONS', `first line
second line ${name}`, {});
}
