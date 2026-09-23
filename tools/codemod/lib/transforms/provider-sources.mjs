const returnKind = value => ({
  auto: 'auto-detect', raw: 'uninspected', nativePromise: 'native-promise',
})[value];

const modeTypeArgument = { fromFactory: 1, fromFunction: 2, fromClass: 2, fromPlugin: 2 };

function explicitKindReplacements(call, api) {
  const index = modeTypeArgument[api.member.name];
  const argument = index === undefined ? undefined : call.typeArguments?.[index];
  if (argument === undefined) return [];
  const replacements = [];
  const visit = node => {
    if (api.ts.isLiteralTypeNode(node) && (api.ts.isStringLiteral(node.literal) || api.ts.isNoSubstitutionTemplateLiteral(node.literal))) {
      const mapped = returnKind(node.literal.text);
      if (mapped === undefined) return false;
      const original = api.text(node.literal);
      const delimiter = original[0] === '"' ? '"' : original[0] === '`' ? '`' : "'";
      replacements.push({ start: api.start(node.literal), end: node.literal.end, text: `${delimiter}${mapped}${delimiter}` });
      return true;
    }
    return api.ts.isUnionTypeNode(node) && node.types.every(visit);
  };
  if (!visit(argument)) {
    api.manual(argument, `${api.member.name} has a nonliteral or unsupported explicit return-kind type argument ${index}; rewrite it by hand`);
    return [];
  }
  return [{ start: api.start(argument), end: argument.end, text: api.assemble(argument, replacements) }];
}

function literalProperties(literal, api, operation) {
  const values = new Map();
  for (const property of literal.properties) {
    if (api.ts.isSpreadAssignment(property)) {
      api.manual(operation, `${api.member.name} options contain a spread; rewrite them to ${api.nameOf('DiBagApi', api.member.name)} with explicit factoryReturnKind${api.member.name === 'fromPlugin' ? ' and isValidPluginOutput' : ''} by hand`);
      return undefined;
    }
    if (!api.ts.isPropertyAssignment(property) && !api.ts.isShorthandPropertyAssignment(property)) {
      api.manual(operation, `${api.member.name} options contain a computed or accessor property; rewrite them by hand`);
      return undefined;
    }
    const name = property.name && (api.ts.isIdentifier(property.name) || api.ts.isStringLiteral(property.name)) ? property.name.text : undefined;
    if (name === undefined) {
      api.manual(operation, `${api.member.name} options contain a computed property; rewrite them by hand`);
      return undefined;
    }
    values.set(name, api.ts.isShorthandPropertyAssignment(property) ? api.text(property.name) : api.text(property.initializer));
  }
  return values;
}

function optionFields(call, api, index) {
  const options = call.arguments[index];
  if (options === undefined) return new Map();
  if (!api.ts.isObjectLiteralExpression(options)) {
    api.manual(options, `${api.member.name} options are not an object literal; rewrite them to ${api.nameOf('DiBagApi', api.member.name)} options with factoryReturnKind${api.member.name === 'fromFactory' ? ' and factoryReceivesContext' : ''} by hand`);
    return undefined;
  }
  return literalProperties(options, api, call);
}

function quotedKind(expression, api, operation) {
  if (expression === undefined) return { present: false };
  const node = expression.trim();
  const match = /^(?:'([^']+)'|"([^"]+)")$/.exec(node);
  const mapped = match ? returnKind(match[1] ?? match[2]) : undefined;
  if (mapped === undefined) {
    api.manual(operation, `${api.member.name} acquisitionMode is not a supported string literal; rewrite factoryReturnKind by hand`);
    return undefined;
  }
  return { present: true, text: `'${mapped}'` };
}

function acceptsOnly(options, names, api, operation) {
  const unexpected = [...options.keys()].find(name => !names.includes(name));
  if (unexpected === undefined) return true;
  api.manual(operation, `${api.member.name} options contain unsupported property ${unexpected}; rewrite them by hand`);
  return false;
}

function property(api, role, value) {
  return `${api.nameForRole(role)}: ${value}`;
}

function bagCall(call, api, fields, typeReplacements) {
  const callee = call.expression;
  const replacements = [
    ...typeReplacements,
    { start: api.start(callee.name), end: callee.name.end, text: api.nameOf('DiBagApi', api.member.name) },
    { start: api.start(call.arguments[0]), end: call.arguments[call.arguments.length - 1].end, text: `{ ${fields.join(', ')} }` },
  ];
  return api.assemble(call, replacements);
}

export default function providerSources(call, api) {
  const name = api.member.name;
  const args = call.arguments;
  const typeReplacements = explicitKindReplacements(call, api);
  if (args.some(api.ts.isSpreadElement)) {
    api.manual(call, `${name} is called with a spread argument; rewrite it by hand`);
    return undefined;
  }

  if (name === 'fromFactory' || name === 'fromSyncFactory' || name === 'fromAsyncFactory') {
    if (args.length < 1 || args.length > 2) {
      api.manual(call, `${name} has an unexpected argument count; rewrite it to createProvider by hand`);
      return undefined;
    }
    const options = optionFields(call, api, 1);
    if (options === undefined) return undefined;
    if (!acceptsOnly(options, name === 'fromFactory' ? ['acquisitionMode', 'context'] : ['context'], api, call)) return undefined;
    const fields = [];
    const selected = name === 'fromFactory' ? quotedKind(options.get('acquisitionMode'), api, call) : { present: true, text: name === 'fromSyncFactory' ? `'sync-value'` : `'native-promise'` };
    if (selected === undefined) return undefined;
    if (selected.present) fields.push(property(api, 'returnKind', selected.text));
    const context = options.get('context');
    if (context !== undefined) {
      if (!/^(?:'acquisition'|"acquisition")$/.test(context.trim())) {
        api.manual(call, `${name} context is not the literal 'acquisition'; rewrite factoryReceivesContext by hand`);
        return undefined;
      }
      fields.push(property(api, 'receivesContext', 'true'));
    }
    const callee = call.expression;
    const replacement = [...typeReplacements, { start: api.start(callee.name), end: callee.name.end, text: api.nameOf('DiBagApi', name) }];
    if (fields.length === 0) {
      if (args[1] !== undefined) replacement.push({ start: args[0].end, end: args[1].end, text: '' });
      return api.assemble(call, replacement);
    }
    if (args[1] === undefined) replacement.push({ start: args[0].end, end: args[0].end, text: `, { ${fields.join(', ')} }` });
    else replacement.push({ start: api.start(args[1]), end: args[1].end, text: `{ ${fields.join(', ')} }` });
    return api.assemble(call, replacement);
  }

  if (name === 'fromFunction' || name === 'fromClass') {
    if (args.length < 2 || args.length > 3) {
      api.manual(call, `${name} has an unexpected argument count; rewrite it by hand`);
      return undefined;
    }
    const options = optionFields(call, api, 2);
    if (options === undefined) return undefined;
    if (!acceptsOnly(options, ['acquisitionMode'], api, call)) return undefined;
    const fields = [property(api, 'dependencies', api.text(args[0])), property(api, 'callable', api.text(args[1]))];
    const selected = quotedKind(options.get('acquisitionMode'), api, call);
    if (selected === undefined) return undefined;
    if (selected.present) fields.push(property(api, 'returnKind', selected.text));
    return bagCall(call, api, fields, typeReplacements);
  }

  if (name === 'fromPlugin') {
    if (args.length !== 3) {
      api.manual(call, 'fromPlugin has an unexpected argument count; rewrite it to createProviderFromPlugin by hand');
      return undefined;
    }
    const options = optionFields(call, api, 2);
    if (options === undefined) return undefined;
    if (!acceptsOnly(options, ['acquisitionMode', 'validate'], api, call)) return undefined;
    const selected = quotedKind(options.get('acquisitionMode'), api, call);
    if (selected === undefined) return undefined;
    const validator = options.get('validate');
    if (!selected.present || validator === undefined) {
      api.manual(call, 'fromPlugin options do not have literal acquisitionMode and validate properties; rewrite them by hand');
      return undefined;
    }
    return bagCall(call, api, [
      property(api, 'dependencies', api.text(args[0])),
      property(api, 'descriptor', api.text(args[1])),
      property(api, 'returnKind', selected.text),
      property(api, 'validator', validator),
    ], typeReplacements);
  }

  api.manual(call, `provider-sources does not recognize ${name}`);
  return undefined;
}
