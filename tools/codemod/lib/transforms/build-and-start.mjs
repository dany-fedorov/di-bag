// tools/codemod/lib/transforms/build-and-start.mjs
const IDENTIFIER = /^[A-Za-z_$][A-Za-z0-9_$]*$/;
const propertyName = name => IDENTIFIER.test(name) ? name : JSON.stringify(name);

/**
 * `builder.buildAndStart(keys, options)` becomes `builder.build().ensureServicesReady(keys, options)`.
 * `signal` and `timeoutMs` are renamed. `startupOrder` becomes the mapped concurrency role:
 * 'parallel' is the new default and is dropped, 'sequential' is 1, a number stays that number.
 * Every emitted API name comes from the rename map.
 * @returns {string | undefined} the new call, or undefined after reporting why it was left alone.
 */
export default function buildAndStart(call, api) {
  const { ts } = api;
  const callee = call.expression;
  const [keys, options, ...rest] = call.arguments;
  const signal = api.nameOf('StartupOptions', 'signal');
  const timeout = api.nameOf('StartupOptions', 'timeoutMs');
  const concurrency = api.nameForRole('concurrency');
  if (keys === undefined || rest.length > 0) {
    api.manual(call, `buildAndStart is called with an unexpected number of arguments; rewrite it to ${api.nameOf('Builder', 'build')}().${api.nameOf('Builder', 'buildAndStart')}(serviceKeys, options) by hand`);
    return undefined;
  }
  const separator = api.slice(callee.expression.end, api.start(callee.name));
  const replacements = [{
    start: api.start(callee.name), end: callee.name.end,
    text: `${api.nameOf('Builder', 'build')}()${separator}${api.nameOf('Builder', 'buildAndStart')}`,
  }];
  if (options === undefined) return api.assemble(call, replacements);
  if (!ts.isObjectLiteralExpression(options)) {
    if (!api.provenOptionOrigin(options, 'StartupOptions')) api.manual(options, `these options are not an object literal; where they are built, rename signal to ${signal}, timeoutMs to ${timeout}, and replace startupOrder with ${concurrency}`);
    return api.assemble(call, replacements);
  }
  const spread = options.properties.find(ts.isSpreadAssignment);
  if (spread) {
    api.manual(spread, 'options are spread here; rename signal, timeoutMs and startupOrder where that object is built');
    return undefined;
  }
  const bag = api.objectLiteral(options, {
    rename: key => ({ signal, timeoutMs: timeout })[key],
    replace: {
      startupOrder(property) {
        const value = ts.isPropertyAssignment(property) ? property.initializer : undefined;
        if (value && (ts.isStringLiteral(value) || ts.isNoSubstitutionTemplateLiteral(value))) {
          if (value.text === 'parallel') return null;
          if (value.text === 'sequential') return `${propertyName(concurrency)}: 1`;
        }
        if (value && ts.isNumericLiteral(value)) return `${propertyName(concurrency)}: ${value.text}`;
        api.manual(property, `startupOrder is not a literal; use ${concurrency}: omit it for 'parallel', 1 for 'sequential', or the number`);
        return undefined;
      },
    },
  });
  if (bag === undefined) return undefined;
  replacements.push(bag.remaining === 0
    ? { start: keys.end, end: options.end, text: '' }
    : { start: api.start(options), end: options.end, text: bag.text });
  return api.assemble(call, replacements);
}
