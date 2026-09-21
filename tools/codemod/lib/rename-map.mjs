// tools/codemod/lib/rename-map.mjs
import { readFileSync } from 'node:fs';

/**
 * @typedef {{ kind: 'bag', names: string[], trailing?: { mode: 'merge' | 'keep' | 'drop', keys?: Record<string, string> } } | { kind: 'array' }} ArgumentShape
 * @typedef {{ owner: string, from: string, to: string, arity?: number[], arguments?: ArgumentShape, transform?: string }} MethodEntry
 * @typedef {{ owner: string, method: string, argument: number, path?: string[], from: string, to: string }} OptionEntry
 * @typedef {{ owner: string, method: string, argument: number, path?: string[], from: string, to: string } | { owner: string, property: string, from: string, to: string }} ValueEntry
 * @typedef {{ owner: string, from: string, to: string } | { owner: string, from: string, manual: string }} PropertyEntry
 * @typedef {{ from: string, to: string }} TypeEntry
 * @typedef {{ from: string, to: string } | { from: string, manual: string }} CodeEntry
 * @typedef {{ from: string, to: string } | { fromSuffix: string, toSuffix: string }} ImportEntry
 * @typedef {{ version: 1, methods?: MethodEntry[], options?: OptionEntry[], values?: ValueEntry[], properties?: PropertyEntry[], types?: TypeEntry[], codes?: CodeEntry[], imports?: ImportEntry[] }} RenameMap
 */

const SECTIONS = ['methods', 'options', 'values', 'properties', 'types', 'codes', 'imports'];
const isObject = value => typeof value === 'object' && value !== null && !Array.isArray(value);
const isString = value => typeof value === 'string' && value.length > 0;
const isStrings = value => Array.isArray(value) && value.every(isString);

/** Every problem in a map, as readable sentences. An empty array means the map is valid. */
export function validateRenameMap(map, transformIds = []) {
  const problems = [];
  const bad = (section, index, message) => problems.push(`${section}[${index}]: ${message}`);
  if (typeof map !== 'object' || map === null || Array.isArray(map)) return ['the rename map must be an object'];
  if (map.version !== 1) problems.push('version must be 1');
  for (const key of Object.keys(map)) if (key !== 'version' && key !== '$schema' && !SECTIONS.includes(key)) problems.push(`unknown section ${key}`);
  for (const section of SECTIONS) if (map[section] !== undefined && !Array.isArray(map[section])) problems.push(`${section} must be an array`);
  const entries = section => Array.isArray(map[section]) ? map[section] : [];
  entries('methods').forEach((entry, index) => {
    if (!isObject(entry)) return bad('methods', index, 'entry must be an object');
    if (!isString(entry.owner) || !isString(entry.from) || !isString(entry.to)) bad('methods', index, 'owner, from and to are required strings');
    if (entry.arity !== undefined && !(Array.isArray(entry.arity) && entry.arity.every(value => Number.isInteger(value) && value >= 0))) bad('methods', index, 'arity must be an array of non-negative integers');
    if (entry.transform !== undefined && !transformIds.includes(entry.transform)) bad('methods', index, `unknown transform ${entry.transform}`);
    if (entry.transform !== undefined && entry.arguments !== undefined) bad('methods', index, 'use either transform or arguments');
    const shape = entry.arguments;
    if (shape !== undefined) {
      if (!isObject(shape)) bad('methods', index, 'arguments must be an object');
      else if (shape.kind === 'bag') {
        if (!isStrings(shape.names) || shape.names.length === 0) bad('methods', index, 'arguments.names must list at least one property name');
        if (shape.trailing !== undefined) {
          if (!isObject(shape.trailing)) bad('methods', index, 'arguments.trailing must be an object');
          else {
            if (!['merge', 'keep', 'drop'].includes(shape.trailing.mode)) bad('methods', index, 'arguments.trailing.mode must be merge, keep or drop');
            if (shape.trailing.keys !== undefined && !(isObject(shape.trailing.keys) && Object.values(shape.trailing.keys).every(isString))) bad('methods', index, 'arguments.trailing.keys must map property names to property names');
          }
        }
      } else if (shape.kind !== 'array') bad('methods', index, 'arguments.kind must be bag or array');
    }
  });
  entries('options').forEach((entry, index) => {
    if (!isObject(entry)) return bad('options', index, 'entry must be an object');
    if (!isString(entry.owner) || !isString(entry.method) || !isString(entry.from) || !isString(entry.to)) bad('options', index, 'owner, method, argument, from and to are required');
    if (!Number.isInteger(entry.argument) || entry.argument < 0) bad('options', index, 'argument must be a non-negative integer');
    if (entry.path !== undefined && !isStrings(entry.path)) bad('options', index, 'path must be an array of property names');
  });
  entries('values').forEach((entry, index) => {
    if (!isObject(entry)) return bad('values', index, 'entry must be an object');
    const byArgument = isString(entry.method) && entry.property === undefined;
    const byProperty = isString(entry.property);
    if (!isString(entry.owner) || byArgument === byProperty || !isString(entry.from) || !isString(entry.to)) bad('values', index, 'owner, from, to and either method with argument or property are required');
    if (byArgument && (!Number.isInteger(entry.argument) || entry.argument < 0)) bad('values', index, 'argument must be a non-negative integer');
    if (byArgument && entry.path !== undefined && !isStrings(entry.path)) bad('values', index, 'path must be an array of property names');
  });
  entries('properties').forEach((entry, index) => {
    if (!isObject(entry)) return bad('properties', index, 'entry must be an object');
    if (!isString(entry.owner) || !isString(entry.from) || isString(entry.to) === isString(entry.manual)) bad('properties', index, 'owner, from and exactly one of to or manual are required');
  });
  entries('types').forEach((entry, index) => {
    if (!isObject(entry)) return bad('types', index, 'entry must be an object');
    if (!isString(entry.from) || !isString(entry.to)) bad('types', index, 'from and to are required');
  });
  entries('codes').forEach((entry, index) => {
    if (!isObject(entry)) return bad('codes', index, 'entry must be an object');
    if (!isString(entry.from) || !/^DI_BAG_[A-Z_]+$/.test(entry.from) || isString(entry.to) === isString(entry.manual)) bad('codes', index, 'from must be a DI_BAG_ code with exactly one of to or manual');
  });
  entries('imports').forEach((entry, index) => {
    if (!isObject(entry)) return bad('imports', index, 'entry must be an object');
    const exact = isString(entry.from) && isString(entry.to);
    const suffix = isString(entry.fromSuffix) && isString(entry.toSuffix);
    if (exact === suffix) bad('imports', index, 'use either from with to, or fromSuffix with toSuffix');
  });
  return problems;
}

/** Read and validate a map file. Throws one error that lists every problem. */
export function loadRenameMap(file, transformIds = []) {
  const map = JSON.parse(readFileSync(file, 'utf8'));
  const problems = validateRenameMap(map, transformIds);
  if (problems.length) throw new Error(`invalid rename map ${file}:\n${problems.join('\n')}`);
  return map;
}

const pathsEqual = (left = [], right = []) => left.length === right.length && left.every((segment, index) => segment === right[index]);
const pathAtOrBelow = (path = [], prefix = []) => path.length >= prefix.length && prefix.every((segment, index) => segment === path[index]);

/** Lookup tables over a valid map. Every lookup answers from the map alone; nothing is hardcoded. */
export function indexRenameMap(map) {
  const methods = new Map();
  for (const entry of map.methods ?? []) {
    const key = `${entry.owner}.${entry.from}`;
    methods.set(key, [...(methods.get(key) ?? []), entry]);
  }
  const properties = new Map((map.properties ?? []).map(entry => [`${entry.owner}.${entry.from}`, entry]));
  const options = new Map();
  for (const entry of map.options ?? []) {
    const key = `${entry.owner}.${entry.method}`;
    options.set(key, [...(options.get(key) ?? []), entry]);
  }
  const argumentValues = new Map();
  const propertyValues = new Map();
  for (const entry of map.values ?? []) {
    if (entry.property !== undefined) propertyValues.set(`${entry.owner}.${entry.property}=${entry.from}`, entry.to);
    else {
      const key = `${entry.owner}.${entry.method}`;
      argumentValues.set(key, [...(argumentValues.get(key) ?? []), entry]);
    }
  }
  const codes = new Map((map.codes ?? []).map(entry => [entry.from, entry.to === 'manual' ? { from: entry.from, manual: 'this code was split; pick the new code by reading the errors page' } : entry]));
  return {
    methods, properties, options, argumentValues, propertyValues, codes,
    types: new Map((map.types ?? []).map(entry => [entry.from, entry.to])),
    imports: map.imports ?? [],
    /** Names worth asking the checker about; everything else is skipped without a type query. */
    callNames: new Set([...(map.methods ?? []).map(entry => entry.from), ...(map.options ?? []).map(entry => entry.method), ...(map.values ?? []).filter(entry => entry.method !== undefined).map(entry => entry.method)]),
    methodNames: new Set((map.methods ?? []).map(entry => entry.from)),
    memberNames: new Set([...(map.methods ?? []).map(entry => entry.from), ...(map.properties ?? []).map(entry => entry.from)]),
    propertyNames: new Set([...(map.properties ?? []).map(entry => entry.from), ...(map.values ?? []).filter(entry => entry.property !== undefined).map(entry => entry.property)]),
    valuePropertyNames: new Set((map.values ?? []).filter(entry => entry.property !== undefined).map(entry => entry.property)),
    propertyValueTexts: new Set((map.values ?? []).filter(entry => entry.property !== undefined).map(entry => entry.from)),
    /** The method entry for a call with `count` arguments, or undefined. */
    methodFor(owner, name, count) {
      return (methods.get(`${owner}.${name}`) ?? []).find(entry => entry.arity === undefined || count === undefined || entry.arity.includes(count));
    },
    optionsFor(owner, method, argument, path) {
      return (options.get(`${owner}.${method}`) ?? []).filter(entry => entry.argument === argument && pathsEqual(entry.path, path));
    },
    valuesFor(owner, method, argument, path) {
      return (argumentValues.get(`${owner}.${method}`) ?? []).filter(entry => entry.argument === argument && pathsEqual(entry.path, path));
    },
    /** The renames that apply to one argument, as a sentence for a manual item. */
    describeArgumentEntries(owner, method, argument) {
      const label = entry => `${[...(entry.path ?? []), ''].join('.')}`;
      return [
        ...(options.get(`${owner}.${method}`) ?? []).filter(entry => entry.argument === argument).map(entry => `key ${label(entry)}${entry.from} to ${entry.to}`),
        ...(argumentValues.get(`${owner}.${method}`) ?? []).filter(entry => entry.argument === argument).map(entry => `value '${entry.from}' to '${entry.to}'${entry.path?.length ? ` at ${entry.path.join('.')}` : ''}`),
      ].join('; ');
    },
    /** True when some option or value entry rewrites an argument of this method. */
    hasArgumentEntries(owner, method) {
      return options.has(`${owner}.${method}`) || argumentValues.has(`${owner}.${method}`);
    },
    /** True when some option or value entry sits below `path` of this argument. */
    hasEntriesBelow(owner, method, argument, path) {
      const below = entry => entry.argument === argument && pathAtOrBelow(entry.path, path);
      return (options.get(`${owner}.${method}`) ?? []).some(below) || (argumentValues.get(`${owner}.${method}`) ?? []).some(below);
    },
    /** The current name of a library member: the map's target, or the old name when the map does not rename it. */
    nameOf(owner, oldName) {
      const method = (methods.get(`${owner}.${oldName}`) ?? [])[0];
      if (method) return method.to;
      const property = properties.get(`${owner}.${oldName}`);
      return property?.to ?? oldName;
    },
  };
}
