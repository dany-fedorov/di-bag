const IDENTIFIER = /^[A-Za-z_$][A-Za-z0-9_$]*$/;
const propertyName = name => IDENTIFIER.test(name) ? name : JSON.stringify(name);

function methodReplacement(call, api) {
  const name = call.expression.name;
  return { start: api.start(name), end: name.end, text: api.nameOf('Bag', name.text) };
}

function fieldNames(oldName, api) {
  const names = {
    keys: propertyName(api.nameForRole('keys')),
    providers: propertyName(api.nameForRole('providers')),
  };
  return oldName === 'createScope'
    ? { ...names, shared: propertyName(api.nameForRole('sharing')) }
    : names;
}

function shareReplacements(options, call, api, sharedName) {
  const { ts } = api;
  if (!ts.isObjectLiteralExpression(options) || options.properties.length !== 1) {
    api.manual(call, 'the createScope options are not an object literal; rewrite it to createChildContainer by hand');
    return undefined;
  }
  const [property] = options.properties;
  if (ts.isShorthandPropertyAssignment(property) && property.name.text === 'share') {
    return [{ start: api.start(property.name), end: property.name.end, text: `${sharedName}: share` }];
  }
  if (ts.isPropertyAssignment(property) && !ts.isComputedPropertyName(property.name)
      && (ts.isIdentifier(property.name) || ts.isStringLiteral(property.name))
      && property.name.text === 'share') {
    return [{ start: api.start(property.name), end: property.name.end, text: sharedName }];
  }
  api.manual(call, 'the createScope options are not an object literal; rewrite it to createChildContainer by hand');
  return undefined;
}

export default function containerDerivation(call, api) {
  const oldName = call.expression.name.text;
  const args = [...call.arguments];
  const names = fieldNames(oldName, api);
  const replacements = [methodReplacement(call, api)];
  const lifetimeManual = api.childLifetimeManualReason(call);
  if (lifetimeManual !== undefined) api.manual(call, lifetimeManual);
  if (oldName === 'fork') {
    if (args.length === 0 || args.length === 2) return api.assemble(call, replacements);
    api.manual(call, 'fork is called with an unexpected number of arguments; rewrite it to createIndependentContainer by hand');
    return undefined;
  }
  if (args.length === 0 || args.length === 2) return api.assemble(call, replacements);
  if (args.length === 1) {
    const shared = shareReplacements(args[0], call, api, names.shared);
    return shared === undefined ? undefined : api.assemble(call, [...replacements, ...shared]);
  }
  if (args.length === 3) {
    const shared = shareReplacements(args[2], call, api, names.shared);
    return shared === undefined ? undefined : api.assemble(call, [...replacements, ...shared]);
  }
  api.manual(call, 'createScope is called with an unexpected number of arguments; rewrite it to createChildContainer by hand');
  return undefined;
}
