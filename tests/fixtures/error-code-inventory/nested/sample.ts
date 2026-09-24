declare function libraryError(code: string, message: string, details?: object): Error;
declare function diagnosticMessage(code: string, message: string): string;
declare function diagnostic(error: Error, code: string, details: object): void;

export function nested(count: number) {
  return libraryError('DI_BAG_SAMPLE_OPTIONS', `count ${count === 1 ? `${count} item` : `${count} items`}`, {});
}

export function diagnosed(reason: 'timeout' | 'aborted', timeout: number, error: Error) {
  const message = diagnosticMessage('DI_BAG_CLOSED', `wait ${reason === 'timeout' ? `timed out after ${timeout}ms` : 'was aborted'}`);
  diagnostic(error, 'DI_BAG_CLOSED', { reason });
  return message;
}
