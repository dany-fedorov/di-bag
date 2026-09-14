/** Run `run` as a host without `process.getBuiltinModule` (a browser or worker), restoring it afterwards. */
export function withoutBuiltinModule<T>(run: () => T, replacement: unknown = undefined): T {
  const descriptor = Object.getOwnPropertyDescriptor(process, 'getBuiltinModule');
  Object.defineProperty(process, 'getBuiltinModule', { configurable: true, writable: true, value: replacement });
  try { return run(); }
  finally {
    if (descriptor) Object.defineProperty(process, 'getBuiltinModule', descriptor);
    else Reflect.deleteProperty(process, 'getBuiltinModule');
  }
}
