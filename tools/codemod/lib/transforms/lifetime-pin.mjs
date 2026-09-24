function member(api, call) {
  return api.originalMember(call);
}

function ownProperties(ts, literal, api, operation) {
  const values = [];
  for (const property of literal.properties) {
    if (ts.isSpreadAssignment(property)) {
      api.manual(property, `${operation} contains a spread registration; add withLifetime('scoped:one-per-container') to each provider contributed by that spread`);
      continue;
    }
    if (ts.isPropertyAssignment(property)) values.push({ node: property.initializer, valueNode: property.initializer, kind: 'value' });
    else if (ts.isShorthandPropertyAssignment(property)) values.push({ node: property, valueNode: property.name, kind: 'shorthand', name: property.name });
    else if (ts.isMethodDeclaration(property) && property.body && property.name && !ts.isComputedPropertyName(property.name)) {
      values.push({ node: property, valueNode: property, kind: 'method', name: property.name });
    } else api.manual(property, `${operation} contains a computed or accessor registration; add its scoped lifetime by hand`);
  }
  return values;
}

function propertyNamed(ts, literal, name) {
  return literal.properties.find(property =>
    (ts.isPropertyAssignment(property) || ts.isShorthandPropertyAssignment(property)) &&
    ((ts.isIdentifier(property.name) && property.name.text === name) ||
      (ts.isStringLiteralLike(property.name) && property.name.text === name)));
}

function currentRoute(api, call, owner, from, originalArity) {
  if (!api.ts.isPropertyAccessExpression(call.expression)) return undefined;
  const entry = api.entryFor(owner, from, originalArity);
  if (!entry || call.expression.name.text !== entry.to) return undefined;
  const coverage = api.library.memberCoverage(api.library.symbolAt(call.expression.name));
  if (coverage.members.length === 0) return undefined;
  if (!coverage.complete) {
    api.manual(call, `${entry.to} resolves to both DI Bag and non-library declarations; preserve provider lifetimes by hand`);
    return undefined;
  }
  if (coverage.members.length !== 1) return undefined;
  return entry;
}

function mappedOutputs(api, owner, from) {
  const names = new Set();
  for (let arity = 0; arity <= 5; arity++) {
    const entry = api.entryFor(owner, from, arity);
    if (!entry) continue;
    names.add(entry.to);
    for (const value of Object.values(entry.transformNames ?? {})) names.add(value);
  }
  return names;
}

function emittedField(entry, role, argumentPosition) {
  return entry.transformNames?.[role] ?? entry.arguments?.names?.[argumentPosition];
}

function registrationsFromBag(ts, expression, api, operation) {
  if (!ts.isObjectLiteralExpression(expression)) {
    api.manual(expression, `${operation} receives a nonliteral registration bag; add withLifetime('scoped:one-per-container') to each provider in that bag`);
    return [];
  }
  return ownProperties(ts, expression, api, operation);
}

function currentProviderField(ts, options, api, entry, operation, role, argumentPosition, bag) {
  if (!ts.isObjectLiteralExpression(options)) {
    api.manual(options, `${operation} options are not an object literal; preserve provider lifetimes by hand`);
    return [];
  }
  const name = emittedField(entry, role, argumentPosition);
  if (name === undefined) throw new Error(`${entry.owner}.${entry.from} has no emitted ${role} field`);
  let property;
  for (const candidate of options.properties) {
    if (ts.isSpreadAssignment(candidate)) {
      api.manual(candidate, `${operation} options contain a spread; preserve provider lifetimes in the spread source by hand`);
      continue;
    }
    if (propertyNamed(ts, ts.factory.createObjectLiteralExpression([candidate]), name)) property = candidate;
  }
  if (!property) return [];
  if (ts.isPropertyAssignment(property)) {
    return bag
      ? registrationsFromBag(ts, property.initializer, api, operation)
      : [{ node: property.initializer, valueNode: property.initializer, kind: 'value' }];
  }
  if (ts.isShorthandPropertyAssignment(property)) {
    if (bag) {
      api.manual(property, `${operation} receives a nonliteral registration bag; add withLifetime('scoped:one-per-container') to each provider in that bag`);
      return [];
    }
    return [{ node: property, valueNode: property.name, kind: 'shorthand', name: property.name }];
  }
  api.manual(property, `${operation} has a computed or accessor ${name} field; preserve its lifetime by hand`);
  return [];
}

function mappedEntryForOutput(api, owner, from, output) {
  for (let arity = 0; arity <= 5; arity++) {
    const entry = api.entryFor(owner, from, arity);
    if (entry && (entry.to === output || Object.values(entry.transformNames ?? {}).includes(output))) return entry;
  }
  return undefined;
}

function providerForm(ts, expression, api, visited = new Set()) {
  let current = expression;
  while (ts.isParenthesizedExpression(current)) current = current.expression;
  if (ts.isArrowFunction(current) || ts.isFunctionExpression(current) || ts.isMethodDeclaration(current)) return 'factory';
  if (ts.isConditionalExpression(current)) {
    const left = providerForm(ts, current.whenTrue, api, new Set(visited));
    const right = providerForm(ts, current.whenFalse, api, new Set(visited));
    return left === right ? left : 'unknown';
  }
  if (ts.isAsExpression(current) || ts.isSatisfiesExpression(current)) {
    return providerForm(ts, current.expression, api, visited);
  }
  if (ts.isIdentifier(current)) {
    const symbol = ts.isShorthandPropertyAssignment(current.parent)
      ? api.checker.getShorthandAssignmentValueSymbol(current.parent)
      : api.checker.getSymbolAtLocation(current);
    if (!symbol || visited.has(symbol)) return 'unknown';
    visited.add(symbol);
    const declaration = symbol.valueDeclaration;
    if (!declaration || !ts.isVariableDeclaration(declaration) ||
        !declaration.initializer || !(declaration.parent.flags & ts.NodeFlags.Const)) return 'unknown';
    return providerForm(ts, declaration.initializer, api, visited);
  }
  if (!ts.isCallExpression(current)) return 'unknown';
  const selected = member(api, current);
  if (selected?.owner === 'DiBagApi' && selected.name === 'withLifetime') return 'explicit';
  if (selected?.owner === 'Provider' && selected.name === 'withLifetime') return 'explicit';
  if (selected?.owner === 'Provider' && ts.isPropertyAccessExpression(current.expression)) {
    const inner = providerForm(ts, current.expression.expression, api, visited);
    return inner === 'explicit' ? 'explicit' : inner === 'unknown' ? 'unknown' : 'provider';
  }
  if (selected?.owner === 'DiBagApi') {
    if (['fromFactory', 'fromSyncFactory', 'fromAsyncFactory', 'fromFunction', 'fromClass', 'fromPlugin'].includes(selected.name)) return 'provider';
    if (['withDisposal', 'withMetadata', 'transformService'].includes(selected.name) && current.arguments[0]) {
      const inner = providerForm(ts, current.arguments[0], api, visited);
      return inner === 'explicit' ? 'explicit' : inner === 'unknown' ? 'unknown' : 'provider';
    }
  }
  if (ts.isPropertyAccessExpression(current.expression)) {
    const coverage = api.library.memberCoverage(api.library.symbolAt(current.expression.name));
    if (!coverage.complete || coverage.members.length !== 1) return 'unknown';
    const [resolvedCurrent] = coverage.members;
    const currentName = current.expression.name.text;
    if (mappedOutputs(api, 'DiBagApi', 'withLifetime').has(currentName)) return 'explicit';
    const decoratorOutputs = new Set(['withDisposal', 'withMetadata', 'transformService']
      .flatMap(name => [...mappedOutputs(api, 'DiBagApi', name)]));
    if (decoratorOutputs.has(currentName)) {
      let inner;
      if (resolvedCurrent.owner === 'Provider') {
        inner = providerForm(ts, current.expression.expression, api, visited);
      } else {
        const entry = ['withDisposal', 'withMetadata', 'transformService']
          .map(from => mappedEntryForOutput(api, 'DiBagApi', from, currentName))
          .find(Boolean);
        const field = entry && emittedField(entry, 'provider', 0);
        const options = current.arguments[0];
        if (!field || !options || !ts.isObjectLiteralExpression(options)) return 'unknown';
        const property = propertyNamed(ts, options, field);
        if (!property) return 'unknown';
        const nested = ts.isPropertyAssignment(property) ? property.initializer
          : ts.isShorthandPropertyAssignment(property) ? property.name : undefined;
        if (!nested) return 'unknown';
        inner = providerForm(ts, nested, api, visited);
      }
      return inner === 'explicit' ? 'explicit' : inner === 'unknown' ? 'unknown' : 'provider';
    }
    const sourceOutputs = new Set(['fromFactory', 'fromSyncFactory', 'fromAsyncFactory', 'fromFunction', 'fromClass', 'fromPlugin']
      .flatMap(name => [...mappedOutputs(api, 'DiBagApi', name)]));
    if (sourceOutputs.has(currentName)) return 'provider';
  }
  return 'unknown';
}

function importedFacade(ts, sourceFile, api) {
  for (const statement of sourceFile.statements) {
    if (!ts.isImportDeclaration(statement)) continue;
    const bindings = statement.importClause?.namedBindings;
    if (bindings && ts.isNamedImports(bindings)) {
      for (const element of bindings.elements) {
        if (api.library.exportNameOf(api.library.symbolAt(element.name)) === 'DiBag') return element.name.text;
      }
    }
    if (bindings && ts.isNamespaceImport(bindings)) {
      const moduleSymbol = api.checker.getSymbolAtLocation(statement.moduleSpecifier);
      const exported = moduleSymbol?.exports?.get('DiBag');
      if (exported && api.library.exportNameOf(exported) === 'DiBag') return `${bindings.name.text}.DiBag`;
    }
  }
  return undefined;
}

/** Analyze original calls before any renamed text is rendered. */
export function lifetimePinTargets(sourceFile, api) {
  const { ts } = api;
  const targets = new Map();
  const facade = importedFacade(ts, sourceFile, api);

  function add(entries) {
    for (const entry of entries) {
      const form = providerForm(ts, entry.valueNode ?? entry.node, api);
      if (form === 'explicit') continue;
      if (form === 'unknown') {
        api.manual(entry.node, "this provider's lifetime is not visible in the source file; preserve its 0.4 scoped behavior by hand");
        continue;
      }
      targets.set(entry.node, { ...entry, form, facade });
    }
  }

  function visit(node) {
    if (ts.isCallExpression(node)) {
      const selected = member(api, node);
      if (selected?.owner === 'Builder') {
        if (selected.name === 'register') {
          if (node.arguments.length === 1) add(registrationsFromBag(ts, node.arguments[0], api, 'register'));
          else if (node.arguments[1]) add([{ node: node.arguments[1] }]);
        } else if ((selected.name === 'contribute' || selected.name === 'replace') && node.arguments[1]) {
          add([{ node: node.arguments[1] }]);
        }
      } else if (selected?.owner === 'Bag' || selected?.owner === 'Container') {
        if ((selected.name === 'createScope' || selected.name === 'fork') && node.arguments[1]) {
          add(registrationsFromBag(ts, node.arguments[1], api, selected.name));
        }
      } else if (currentRoute(api, node, 'Builder', 'register', 1)) {
        add(registrationsFromBag(ts, node.arguments[0], api, 'withServices'));
      } else {
        const token = currentRoute(api, node, 'Builder', 'register', 2);
        const contribution = currentRoute(api, node, 'Builder', 'contribute', 2);
        const replacement = currentRoute(api, node, 'Builder', 'replace', 2);
        const child = currentRoute(api, node, 'Bag', 'createScope', 2);
        const independent = currentRoute(api, node, 'Bag', 'fork', 2);
        const singular = token ?? contribution ?? replacement;
        if (singular) {
          if (node.arguments[1]) add([{ node: node.arguments[1], valueNode: node.arguments[1], kind: 'value' }]);
          else if (node.arguments[0]) add(currentProviderField(ts, node.arguments[0], api, singular, singular.to, 'provider', 1, false));
        } else if (child || independent) {
          const route = child ?? independent;
          if (node.arguments[1]) add(registrationsFromBag(ts, node.arguments[1], api, route.to));
          else if (node.arguments[0]) add(currentProviderField(ts, node.arguments[0], api, route, route.to, 'providers', 1, true));
        }
      }
    }
    ts.forEachChild(node, visit);
  }
  visit(sourceFile);
  return targets;
}

export function renderLifetimePin(node, target, rendered, api) {
  const value = target.valueNode ?? node;
  const factoryText = target.kind === 'method'
    ? `${value.modifiers?.some(modifier => modifier.kind === api.ts.SyntaxKind.AsyncKeyword) ? 'async ' : ''}function${value.asteriskToken ? '*' : ''}${value.typeParameters?.length ? `<${value.typeParameters.map(parameter => api.text(parameter)).join(', ')}>` : ''}(${value.parameters.map(parameter => api.text(parameter)).join(', ')})${value.type ? `: ${api.text(value.type)}` : ''} ${api.text(value.body)}`
    : rendered;
  const withLifetime = api.nameOf('DiBagApi', 'withLifetime');
  let pinned;
  if (withLifetime !== 'withLifetime') {
    if (target.facade === undefined) {
      api.manual(node, 'no resolved DiBag import is available to add providerWithLifetime; preserve scoped lifetime by hand');
      return rendered;
    }
    pinned = `${target.facade}.${withLifetime}({ provider: ${factoryText}, lifetime: 'scoped:one-per-container' })`;
  } else {
    const providerText = target.form === 'factory'
      ? target.facade === undefined ? undefined : `${target.facade}.${api.nameOf('DiBagApi', 'fromFactory')}(${factoryText})`
      : rendered;
    if (providerText === undefined) {
      api.manual(node, "no resolved DiBag import is available to wrap this factory; create a provider and add withLifetime('scoped:one-per-container') by hand");
      return rendered;
    }
    pinned = `(${providerText}).${withLifetime}('scoped:one-per-container')`;
  }
  return target.kind === 'shorthand' || target.kind === 'method'
    ? `${api.text(target.name)}: ${pinned}`
    : pinned;
}

export function hasOldCreateScope({ ts, sourceFiles, library, index }) {
  for (const sourceFile of sourceFiles) {
    let found = false;
    function visit(node) {
      if (found) return;
      if (ts.isCallExpression(node) && ts.isPropertyAccessExpression(node.expression)) {
        const name = node.expression.name.text;
        const coverage = library.memberCoverage(library.symbolAt(node.expression.name));
        found = name === 'createScope' && coverage.complete && coverage.members.length === 1
          && index.methodFor(coverage.members[0].owner, name, node.arguments.length)?.owner === 'Bag';
      }
      if (!found) ts.forEachChild(node, visit);
    }
    visit(sourceFile);
    if (found) return true;
  }
  return false;
}
