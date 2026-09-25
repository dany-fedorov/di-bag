import { originalKind, literalBag, valueOf, nodeOf, renamedLiteral, text, textWithTrivia } from './provider-methods.mjs';

const IDENTIFIER = /^[A-Za-z_$][A-Za-z0-9_$]*$/;
const propertyName = name => IDENTIFIER.test(name) ? name : JSON.stringify(name);
const field = (role, value, api) => `${propertyName(api.nameForRole(role))}: ${value}`;
const member = (receiver, role, api) => {
  const name = api.nameForRole(role);
  return IDENTIFIER.test(name) ? `${receiver}.${name}` : `${receiver}[${JSON.stringify(name)}]`;
};
const bagCall = (facade, role, fields, api) =>
  `${member(facade, role, api)}({ ${fields.join(', ')} })`;
const callbackValues = new Map([['direct', 'exposed-service'], ['awaited', 'fulfilled-value']]);
const lifetimeValues = new Map([['root', 'singleton:one-per-container-tree'], ['scoped', 'scoped:one-per-container'], ['transient', 'transient:one-per-resolve']]);
const returnValues = new Map([['auto', 'auto-detect'], ['raw', 'uninspected'], ['nativePromise', 'native-promise']]);

export default function providerFacades(call, api) {
  const oldName = call.expression.name.text;
  const registration = call.arguments[0];
  if (originalKind(registration, api) === 'manual') {
    api.manual(call, 'the decorated value is any, unknown, invalid, or a factory/provider union; wrap a factory with createProvider or supply a provider by hand');
    return undefined;
  }
  const facade = text(call.expression.expression, api);
  const receiver = text(registration, api);
  if (oldName === 'withDisposal') return bagCall(facade, 'method', [field('provider', receiver, api), field('disposeService', textWithTrivia(call.arguments[1], api).trimStart(), api)], api);
  if (oldName === 'withLifetime') {
    const oldLifetime = call.arguments[1];
    const adjustment = api.childLifetimeAdjustment(call);
    const lifetime = adjustment
      ? api.quote(oldLifetime, adjustment.lifetime)
      : renamedLiteral(oldLifetime, lifetimeValues, call, 'withLifetime uses a nonliteral lifetime; rewrite it to a full lifetime value by hand', api);
    if (lifetime === undefined) return undefined;
    const fields = [field('provider', receiver, api), field('lifetime', lifetime, api)];
    let hasAllows = false;
    if (call.arguments[2] !== undefined) {
      const options = literalBag(call.arguments[2], new Set(['allowScopedDependencies']), call, 'the withLifetime options are not a supported object literal; rewrite the provider bag by hand', api);
      if (options === undefined) return undefined;
      const allows = valueOf(options, 'allowScopedDependencies', api);
      if (allows !== undefined) { fields.push(field('allowsScopedDependencies', allows, api)); hasAllows = true; }
    }
    if (adjustment?.addAllows && !hasAllows) fields.push(field('allowsScopedDependencies', 'true', api));
    return bagCall(facade, 'method', fields, api);
  }
  const allowed = oldName === 'transformService' ? new Set(['mode', 'transform', 'acquisitionMode']) : new Set(['static', 'dynamic']);
  const options = literalBag(call.arguments[1], allowed, call, `the ${oldName} options are not a supported object literal; rewrite the provider bag by hand`, api);
  if (options === undefined) return undefined;
  if (oldName === 'transformService') {
    const transform = valueOf(options, 'transform', api);
    const receives = renamedLiteral(nodeOf(options, 'mode', api), callbackValues, call, 'transformService mode is nonliteral; choose callbackReceives by hand', api);
    const returnNode = nodeOf(options, 'acquisitionMode', api);
    const returnKind = returnNode === undefined ? undefined : renamedLiteral(returnNode, returnValues, call, 'transformService acquisitionMode is nonliteral; choose transformReturnKind by hand', api);
    if (transform === undefined || receives === undefined || (returnNode !== undefined && returnKind === undefined)) return undefined;
    const fields = [field('provider', receiver, api), field('transformService', transform, api), field('callbackReceives', receives, api)];
    if (returnKind !== undefined) fields.push(field('transformReturnKind', returnKind, api));
    return bagCall(facade, 'method', fields, api);
  }
  const registrationMetadata = valueOf(options, 'static', api);
  const dynamicProperty = options.get('dynamic');
  if (registrationMetadata !== undefined && dynamicProperty !== undefined) {
    api.manual(call, 'combined static and dynamic metadata can change evaluation order when split; rewrite the two provider bags by hand');
    return undefined;
  }
  if (registrationMetadata !== undefined) return bagCall(facade, 'registrationFacade', [field('provider', receiver, api), field('registrationMetadata', registrationMetadata, api)], api);
  if (!dynamicProperty || !api.ts.isPropertyAssignment(dynamicProperty)) {
    api.manual(call, 'withMetadata dynamic options are opaque; rewrite the provider bag by hand');
    return undefined;
  }
  const dynamic = literalBag(dynamicProperty.initializer, new Set(['mode', 'describe']), call, 'withMetadata dynamic options are not a supported object literal; rewrite the provider bag by hand', api);
  if (dynamic === undefined) return undefined;
  const describe = valueOf(dynamic, 'describe', api);
  const receives = renamedLiteral(nodeOf(dynamic, 'mode', api), callbackValues, call, 'withMetadata dynamic mode is nonliteral; choose callbackReceives by hand', api);
  if (describe === undefined || receives === undefined) return undefined;
  return bagCall(facade, 'acquisitionFacade', [field('provider', receiver, api), field('describeAcquisition', describe, api), field('callbackReceives', receives, api)], api);
}
