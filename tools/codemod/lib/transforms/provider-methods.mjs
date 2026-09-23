export function originalKind(node, api) {
  const type = api.checker.getTypeAtLocation(node);
  if (type.flags & (api.ts.TypeFlags.Any | api.ts.TypeFlags.Unknown | api.ts.TypeFlags.TypeParameter)) return 'manual';
  const members = type.isUnion() ? type.types : [type];
  const kinds = members.map(member => {
    if (api.checker.getSignaturesOfType(member, api.ts.SignatureKind.Call).length > 0) return 'factory';
    const unresolved = member.aliasSymbol ?? member.getSymbol();
    const symbol = unresolved?.flags & api.ts.SymbolFlags.Alias ? api.checker.getAliasedSymbol(unresolved) : unresolved;
    const bases = member.getBaseTypes?.() ?? [];
    const authentic = candidate => candidate?.declarations?.some(declaration => api.library.isLibraryFile(declaration.getSourceFile().fileName));
    if (authentic(symbol) && (symbol?.name === 'FactoryWithDisposal' || symbol?.name === 'Provider' || symbol?.name === 'ProviderBase')) return 'provider';
    if (bases.some(base => { const unresolvedBase = base.aliasSymbol ?? base.getSymbol(); const baseSymbol = unresolvedBase?.flags & api.ts.SymbolFlags.Alias ? api.checker.getAliasedSymbol(unresolvedBase) : unresolvedBase; return authentic(baseSymbol) && baseSymbol?.name === 'ProviderBase'; })) return 'provider';
    return 'invalid';
  });
  return kinds.every(kind => kind === 'factory') ? 'factory'
    : kinds.every(kind => kind === 'provider') ? 'provider'
    : 'manual';
}
export const text = (node, api) => api.text(node);
export const textWithTrivia = (node, api) => `${api.slice(node.pos, api.start(node))}${api.text(node)}`;
const prop = (property, api) => (api.ts.isPropertyAssignment(property) || api.ts.isShorthandPropertyAssignment(property)) && !api.ts.isComputedPropertyName(property.name) ? property.name.text : undefined;
export function literalBag(node, allowed, call, reason, api) {
  if (!api.ts.isObjectLiteralExpression(node) || node.properties.some(item => api.ts.isSpreadAssignment(item) || api.ts.isMethodDeclaration(item) || api.ts.isGetAccessorDeclaration(item) || api.ts.isSetAccessorDeclaration(item) || prop(item, api) === undefined || !allowed.has(prop(item, api)))) { api.manual(call, reason); return undefined; }
  const names = node.properties.map(item => prop(item, api));
  if (new Set(names).size !== names.length || /\/\*|\/\//.test(api.slice(api.start(node), node.end))) { api.manual(call, `${reason}; duplicate keys and comments require a hand rewrite`); return undefined; }
  return new Map(node.properties.map(item => [prop(item, api), item]));
}
export function valueOf(map, name, api) { const item = map.get(name); return item && api.ts.isShorthandPropertyAssignment(item) ? text(item.name, api) : item && api.ts.isPropertyAssignment(item) ? textWithTrivia(item.initializer, api).trimStart() : undefined; }
export function nodeOf(map, name, api) { const item = map.get(name); return item && api.ts.isShorthandPropertyAssignment(item) ? item.name : item && api.ts.isPropertyAssignment(item) ? item.initializer : undefined; }
export function renamedLiteral(node, values, call, reason, api) {
  if (!node || (!api.ts.isStringLiteral(node) && !api.ts.isNoSubstitutionTemplateLiteral(node))) { api.manual(call, reason); return undefined; }
  return api.quote(node, values.get(node.text) ?? node.text);
}
export function lifetimeOptions(node, call, api) {
  if (node === undefined) return undefined;
  const bag = literalBag(node, new Set(['allowScopedDependencies']), call, 'the withLifetime options are not a supported object literal; rewrite the provider chain by hand', api); if (bag === undefined) return null;
  const item = bag.get('allowScopedDependencies');
  if (item === undefined) return text(node, api);
  if (api.ts.isShorthandPropertyAssignment(item)) return api.assemble(node, [{ start: api.start(item), end: item.end, text: `${api.nameForRole('allowsScopedDependencies')}: ${text(item.name, api)}` }]);
  return api.assemble(node, [{ start: api.start(item.name), end: item.name.end, text: api.nameForRole('allowsScopedDependencies') }]);
}
function method(receiver, oldName, args, api) { return `(${receiver}).${api.nameOf('DiBagApi', oldName)}(${args.join(', ')})`; }
function receiverFor(call, api) {
  const registration = call.arguments[0];
  const kind = originalKind(registration, api);
  if (kind === 'manual') { api.manual(call, 'the decorated value is any, unknown, invalid, or a factory/provider union; wrap a factory with createProvider or supply a provider by hand'); return undefined; }
  const source = text(registration, api);
  if (kind === 'provider') return source;
  const facade = text(call.expression.expression, api);
  return `${facade}.${api.nameOf('DiBagApi', 'fromFactory')}(${source})`;
}
export default function providerMethods(call, api) {
  const oldName = call.expression.name.text;
  const receiver = receiverFor(call, api); if (receiver === undefined) return undefined;
  if (oldName === 'withDisposal') return method(receiver, oldName, [textWithTrivia(call.arguments[1], api).trimStart()], api);
  if (oldName === 'withLifetime') {
    const lifetime = renamedLiteral(call.arguments[1], new Map([['root', 'singleton:one-per-container-tree'], ['scoped', 'scoped:one-per-container'], ['transient', 'transient:one-per-resolve']]), call, 'withLifetime uses a nonliteral lifetime; rewrite it to a full lifetime value by hand', api);
    if (lifetime === undefined) return undefined;
    const options = lifetimeOptions(call.arguments[2], call, api); if (options === null) return undefined;
    return method(receiver, oldName, options === undefined ? [lifetime] : [lifetime, options], api);
  }
  const allowed = oldName === 'transformService' ? new Set(['mode', 'transform', 'acquisitionMode']) : new Set(['static', 'dynamic']);
  const options = literalBag(call.arguments[1], allowed, call, `the ${oldName} options are not a supported object literal; rewrite the provider chain by hand`, api);
  if (options === undefined) return undefined;
  if (oldName === 'transformService') {
    const callback = valueOf(options, 'transform', api);
    const receives = renamedLiteral(nodeOf(options, 'mode', api), new Map([['direct', 'exposed-service'], ['awaited', 'fulfilled-value']]), call, 'transformService mode is nonliteral; choose callbackReceives by hand', api);
    const returnNode = nodeOf(options, 'acquisitionMode', api);
    const returnKind = returnNode === undefined ? undefined : renamedLiteral(returnNode, new Map([['auto', 'auto-detect'], ['raw', 'uninspected'], ['nativePromise', 'native-promise']]), call, 'transformService acquisitionMode is nonliteral; choose transformReturnKind by hand', api);
    if (callback === undefined || receives === undefined || (returnNode !== undefined && returnKind === undefined)) { if (callback === undefined) api.manual(call, 'transformService options must contain transform and mode; rewrite the provider chain by hand'); return undefined; }
    const fields = [`${api.nameForRole('transformService')}: ${callback}`, `${api.nameForRole('callbackReceives')}: ${receives}`];
    if (returnKind !== undefined) fields.push(`${api.nameForRole('transformReturnKind')}: ${returnKind}`);
    return method(receiver, oldName, [`{ ${fields.join(', ')} }`], api);
  }
  const staticValue = valueOf(options, 'static', api), dynamicNode = options.get('dynamic');
  if (staticValue !== undefined && dynamicNode !== undefined) {
    api.manual(call, 'combined static and dynamic metadata can change evaluation order when split; rewrite the two provider methods by hand');
    return undefined;
  }
  let result = receiver;
  if (staticValue !== undefined) result = method(result, oldName, [staticValue], api);
  if (dynamicNode !== undefined && !api.ts.isPropertyAssignment(dynamicNode)) { api.manual(call, 'withMetadata shorthand dynamic options are opaque; rewrite the provider chain by hand'); return undefined; }
  if (dynamicNode !== undefined && api.ts.isPropertyAssignment(dynamicNode)) {
    const dynamic = literalBag(dynamicNode.initializer, new Set(['mode', 'describe']), call, 'withMetadata dynamic options are not a supported object literal; rewrite the provider chain by hand', api); if (dynamic === undefined) return undefined;
    const describe = valueOf(dynamic, 'describe', api);
    const mode = renamedLiteral(nodeOf(dynamic, 'mode', api), new Map([['direct', 'exposed-service'], ['awaited', 'fulfilled-value']]), call, 'withMetadata dynamic mode is nonliteral; choose callbackReceives by hand', api);
    if (describe === undefined || mode === undefined) { api.manual(call, 'withMetadata dynamic options must contain describe and mode; rewrite the provider chain by hand'); return undefined; }
    result = `(${result}).${api.nameForRole('acquisitionMethod')}({ ${api.nameForRole('describeAcquisition')}: ${describe}, ${api.nameForRole('callbackReceives')}: ${mode} })`;
  }
  if (staticValue === undefined && dynamicNode === undefined) { api.manual(call, 'withMetadata has neither static nor dynamic metadata; rewrite the provider chain by hand'); return undefined; }
  return result;
}
