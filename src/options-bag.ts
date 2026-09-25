import { libraryError } from './errors';

/**
 * Snapshot the own properties of an options bag once, before any value is used.
 * Unknown own or symbol-keyed properties are rejected. A supported property supplied
 * only by the prototype is rejected, so an accessor cannot substitute it for an own value.
 * Every listed property is read exactly once, in the order `required` then `optional`.
 */
export function snapshotOptionsBag(
  options: unknown,
  operation: string,
  required: readonly string[],
  optional: readonly string[] = [],
  inspectValue?: (name: string, value: unknown) => void,
): Record<string, unknown> {
  const supported = [...required, ...optional];
  if (typeof options !== 'object' || options === null || Array.isArray(options)) {
    throw libraryError('DI_BAG_INVALID_ARGUMENT', `${operation} requires one options object`, { operation, argument: 'options', expected: 'an object' });
  }
  for (const key of Reflect.ownKeys(options)) {
    if (typeof key !== 'string' || !supported.includes(key)) {
      throw libraryError('DI_BAG_INVALID_ARGUMENT', `${operation} does not accept the option ${String(key)}`, { operation, argument: 'options', expected: `only the own properties: ${supported.join(', ')}` });
    }
  }
  for (const name of supported) {
    if (name in options && !Object.hasOwn(options, name)) {
      throw libraryError('DI_BAG_INVALID_ARGUMENT', `${operation} reads own properties only: ${name} is inherited`, { operation, argument: 'options', expected: `only the own properties: ${supported.join(', ')}` });
    }
  }
  for (const name of required) {
    if (!Object.hasOwn(options, name)) {
      throw libraryError('DI_BAG_INVALID_ARGUMENT', `${operation} requires the option ${name}`, { operation, argument: name, expected: 'present' });
    }
  }
  const snapshot: Record<string, unknown> = Object.create(null);
  for (const name of supported) {
    if (Object.hasOwn(options, name)) {
      const value = Reflect.get(options, name);
      inspectValue?.(name, value);
      snapshot[name] = value;
    }
  }
  return snapshot;
}
