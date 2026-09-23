// tools/graph/lib/extract.mjs
import { createRequire } from 'node:module';
import { dirname, relative, resolve } from 'node:path';

const TERMINALS = new Set(['buildContainer', 'buildModule', 'build', 'buildAndStart']);
const WRAPPERS = new Set(['withLifetime', 'withDisposal', 'withMetadata', 'transformService']);
const PROVIDER_FACADES = new Set(['providerWithDisposal', 'providerWithLifetime', 'providerWithRegistrationMetadata', 'providerWithAcquisitionMetadata', 'providerWithTransformedService']);
const LIFETIMES = new Map([
  ['root', 'singleton:one-per-container-tree'],
  ['scoped', 'scoped:one-per-container'],
  ['transient', 'transient:one-per-resolve'],
  ['singleton:one-per-container-tree', 'singleton:one-per-container-tree'],
  ['scoped:one-per-container', 'scoped:one-per-container'],
  ['transient:one-per-resolve', 'transient:one-per-resolve'],
]);

// Set per extraction: the consumer's compiler or the bundled one.
let ts;

function atLeast(version, minimum) {
  const parts = String(version).split(/[.-]/).map(Number);
  for (let index = 0; index < minimum.length; index++) {
    if ((parts[index] ?? 0) !== minimum[index]) return (parts[index] ?? 0) > minimum[index];
  }
  return true;
}

/**
 * The project's `typescript` when it exposes the compiler API at 6.0.3 or later, else the bundled copy.
 * TypeScript 7 ships no compatible JavaScript API, so a project on 7 is analyzed with the bundled 6.
 * @param {string} from - A directory inside the project.
 * @returns {{ ts: typeof import('typescript'), version: string, source: 'project' | 'bundled' }}
 */
export function loadTypeScript(from) {
  const bundledPath = createRequire(import.meta.url).resolve('typescript');
  try {
    const require = createRequire(resolve(from, 'package.json'));
    const path = require.resolve('typescript');
    const candidate = require(path);
    if (path !== bundledPath && typeof candidate.createProgram === 'function' && atLeast(candidate.version, [6, 0, 3])) {
      return { ts: candidate, version: candidate.version, source: 'project' };
    }
  } catch {
    // No resolvable typescript in the project.
  }
  const bundled = createRequire(import.meta.url)(bundledPath);
  return { ts: bundled, version: bundled.version, source: 'bundled' };
}

function loadProgram({ project, files, root }) {
  if (project) {
    const config = ts.getParsedCommandLineOfConfigFile(resolve(root, project), {}, {
      ...ts.sys, onUnRecoverableConfigFileDiagnostic: diagnostic => { throw new Error(ts.flattenDiagnosticMessageText(diagnostic.messageText, '\n')); },
    });
    return ts.createProgram(config.fileNames, { ...config.options, noEmit: true });
  }
  return ts.createProgram(files.map(file => resolve(root, file)), {
    strict: true, noEmit: true, skipLibCheck: true, types: [],
    target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.NodeNext, moduleResolution: ts.ModuleResolutionKind.NodeNext,
  });
}

/** The property-access method name of a call such as `x.register(...)`, or undefined. */
function methodName(call) {
  return ts.isPropertyAccessExpression(call.expression) ? call.expression.name.text : undefined;
}

/** Strip parentheses, `as`, and `satisfies` around an expression. */
function skipOuter(expression) {
  while (ts.isParenthesizedExpression(expression) || ts.isAsExpression(expression) || ts.isSatisfiesExpression(expression)) expression = expression.expression;
  return expression;
}

function literalLifetime(expression) {
  const inner = expression && skipOuter(expression);
  return inner && ts.isStringLiteralLike(inner) ? LIFETIMES.get(inner.text) : undefined;
}

function diBagDeclarationOwners(sourceFile, checker) {
  const owners = new Set();
  for (const statement of sourceFile.statements) {
    if (!ts.isImportDeclaration(statement) || !ts.isStringLiteral(statement.moduleSpecifier)) continue;
    const specifier = statement.moduleSpecifier.text;
    if (specifier !== 'di-bag' && specifier !== 'di-bag/node'
        && !specifier.endsWith('/provider-sources-0-4-library.js')) continue;
    let moduleSymbol = checker.getSymbolAtLocation(statement.moduleSpecifier);
    if (moduleSymbol?.flags & ts.SymbolFlags.Alias) moduleSymbol = checker.getAliasedSymbol(moduleSymbol);
    for (const exported of moduleSymbol ? checker.getExportsOfModule(moduleSymbol) : []) {
      const symbol = exported.flags & ts.SymbolFlags.Alias ? checker.getAliasedSymbol(exported) : exported;
      if (symbol.name !== 'Provider' && symbol.name !== 'DiBagApi') continue;
      if ((symbol.declarations ?? []).some(declaration =>
        (ts.isClassDeclaration(declaration) || ts.isInterfaceDeclaration(declaration))
        && declaration.name?.text === symbol.name)) owners.add(symbol);
    }
  }
  return owners;
}

function declarationOwner(nameNode, checker, declarationOwners) {
  let symbol = checker.getSymbolAtLocation(nameNode);
  if (symbol?.flags & ts.SymbolFlags.Alias) symbol = checker.getAliasedSymbol(symbol);
  for (const declaration of symbol?.declarations ?? []) {
    for (let node = declaration.parent; node; node = node.parent) {
      if (!(ts.isClassDeclaration(node) || ts.isInterfaceDeclaration(node)) || !node.name) continue;
      let owner = checker.getSymbolAtLocation(node.name);
      if (owner?.flags & ts.SymbolFlags.Alias) owner = checker.getAliasedSymbol(owner);
      if (owner && declarationOwners.has(owner)) return node.name.text;
      break;
    }
  }
  return undefined;
}

/** The variable initializer an identifier names, following imports. */
function initializerOf(identifier, checker) {
  let symbol = checker.getSymbolAtLocation(identifier);
  if (symbol && symbol.flags & ts.SymbolFlags.Alias) symbol = checker.getAliasedSymbol(symbol);
  const declaration = symbol?.valueDeclaration;
  return declaration && ts.isVariableDeclaration(declaration) && declaration.initializer ? declaration.initializer : undefined;
}

/** Walk a fluent chain downward, following identifiers to the partial builders they name. */
function chainCalls(call, checker, seen = new Set()) {
  const calls = [];
  let current = call;
  while (current) {
    if (ts.isCallExpression(current)) {
      calls.push(current);
      current = ts.isPropertyAccessExpression(current.expression) ? current.expression.expression : undefined;
    } else if (ts.isIdentifier(current)) {
      const initializer = initializerOf(current, checker);
      if (!initializer || seen.has(initializer)) break;
      seen.add(initializer);
      current = initializer;
    } else if (current !== skipOuter(current)) {
      current = skipOuter(current);
    } else break;
  }
  return calls.reverse();
}

function isChainStart(calls) {
  return calls.length > 0 && methodName(calls[0]) === 'createBuilder';
}

function ownBagValue(call, name) {
  const bag = call.arguments[0];
  if (!bag || !ts.isObjectLiteralExpression(skipOuter(bag))) return undefined;
  const literal = skipOuter(bag);
  const item = literal.properties.find(property => ts.isPropertyAssignment(property)
    && !ts.isComputedPropertyName(property.name) && keyText(property.name) === name);
  return item?.initializer;
}

/** Unwrap authenticated current facades and 0.4 decorators, reading lifetime and ownership on the way. */
function unwrap(expression, checker, declarationOwners) {
  let lifetime = 'scoped:one-per-container', lifetimeSelected = false, owned = false, opaque = false;
  let inner = skipOuter(expression);
  const seen = new Set();
  while (inner) {
    if (ts.isIdentifier(inner)) {
      const initializer = initializerOf(inner, checker);
      if (!initializer || seen.has(initializer)) break;
      seen.add(initializer);
      inner = skipOuter(initializer);
      continue;
    }
    if (!ts.isCallExpression(inner) || !ts.isPropertyAccessExpression(inner.expression)) break;
    const name = inner.expression.name.text;
    const owner = declarationOwner(inner.expression.name, checker, declarationOwners);
    if (owner === 'DiBagApi' && PROVIDER_FACADES.has(name)) {
      if (name === 'providerWithDisposal') owned = true;
      if (name === 'providerWithLifetime' && !lifetimeSelected) {
        const selected = literalLifetime(ownBagValue(inner, 'lifetime'));
        if (selected === undefined) opaque = true; else lifetime = selected;
        lifetimeSelected = true;
      }
      const provider = ownBagValue(inner, 'provider');
      if (provider === undefined) { opaque = true; break; }
      inner = skipOuter(provider);
      continue;
    }
    if (owner === 'DiBagApi' && WRAPPERS.has(name)) {
      if (name === 'withDisposal') owned = true;
      if (name === 'withLifetime' && !lifetimeSelected) {
        const selected = literalLifetime(inner.arguments[1]);
        if (selected === undefined) opaque = true; else lifetime = selected;
        lifetimeSelected = true;
      }
      if (!inner.arguments[0]) { opaque = true; break; }
      inner = skipOuter(inner.arguments[0]);
      continue;
    }
    break;
  }
  return { inner, lifetime: opaque ? 'dynamic' : lifetime, owned };
}

/** Declared named dependencies and async-ness of a factory expression, through the checker. */
function describeFactory(expression, checker) {
  const type = checker.getTypeAtLocation(expression);
  let signature = type.getCallSignatures()[0];
  const isReference = (type.getFlags() & ts.TypeFlags.Object) !== 0 && (type.objectFlags & ts.ObjectFlags.Reference) !== 0;
  if (!signature && isReference) {
    // Provider<F, ...> and FactoryWithDisposal<F> both carry the factory as their first type argument.
    const [first] = checker.getTypeArguments(type);
    signature = first?.getCallSignatures()[0];
  }
  if (!signature) return { dependencies: [], async: false };
  const parameter = signature.getParameters()[0];
  const dependencies = parameter ? checker.getTypeOfSymbolAtLocation(parameter, expression).getProperties().map(property => property.name) : [];
  const returned = checker.getReturnTypeOfSignature(signature);
  const async = checker.typeToString(returned).startsWith('Promise<');
  return { dependencies, async };
}

function keyText(expression) {
  if (ts.isStringLiteral(expression)) return expression.text;
  if (ts.isIdentifier(expression)) return expression.text;
  return expression.getText();
}

function bagProperty(literal, name) {
  for (const property of literal.properties) {
    if (ts.isPropertyAssignment(property) && keyText(property.name) === name) return property.initializer;
    if (ts.isShorthandPropertyAssignment(property) && property.name.text === name) return property.name;
  }
  return undefined;
}

function optionsBag(call) {
  return call.arguments.length === 1 && ts.isObjectLiteralExpression(call.arguments[0]) ? call.arguments[0] : undefined;
}

function literalString(expression) {
  const inner = skipOuter(expression);
  return ts.isStringLiteralLike(inner) ? inner.text : undefined;
}

/** A closed literal view bag, or undefined when applying any part would be a guess. */
function literalBagPair(call, currentName, newName) {
  const bag = optionsBag(call);
  if (!bag || bag.properties.length !== 2) return undefined;
  const values = new Map();
  for (const property of bag.properties) {
    if (!ts.isPropertyAssignment(property) || ts.isComputedPropertyName(property.name)
        || !(ts.isIdentifier(property.name) || ts.isStringLiteral(property.name))) return undefined;
    const name = property.name.text;
    if (![currentName, newName].includes(name) || values.has(name)) return undefined;
    const value = literalString(property.initializer);
    if (value === undefined) return undefined;
    values.set(name, value);
  }
  const current = values.get(currentName), next = values.get(newName);
  if (current === undefined || next === undefined) return undefined;
  return current === next ? [] : [current, next];
}

function moduleView(expression) {
  const exportRenames = [], requirementRenames = [];
  let current = skipOuter(expression);
  while (ts.isCallExpression(current) && ts.isPropertyAccessExpression(current.expression)) {
    const name = methodName(current);
    if (name === 'renameExport') {
      const [from, to] = current.arguments;
      if (from && to) exportRenames.unshift([keyText(from), keyText(to)]);
    } else if (name === 'withRenamedExport') {
      const pair = literalBagPair(current, 'currentExportKey', 'newExportKey');
      if (!pair) break;
      if (pair.length > 0) exportRenames.unshift(pair);
    } else if (name === 'withRenamedRequirement') {
      const pair = literalBagPair(current, 'currentRequirementKey', 'newRequirementKey');
      if (!pair) break;
      if (pair.length > 0) requirementRenames.unshift(pair);
    } else break;
    current = skipOuter(current.expression.expression);
  }
  return { expression: current, exportRenames, requirementRenames };
}

function listedModules(argument, checker) {
  let expression = skipOuter(argument);
  if (ts.isIdentifier(expression)) {
    const initializer = initializerOf(expression, checker);
    if (initializer && ts.isArrayLiteralExpression(skipOuter(initializer))) expression = skipOuter(initializer);
  }
  return ts.isArrayLiteralExpression(expression) ? [...expression.elements] : [argument];
}

function readUnit(terminal, sourceFile, checker, declarationOwners, root) {
  const calls = chainCalls(terminal, checker);
  const nodes = [], installs = [], aliases = [];
  let exports = [], label;
  for (const call of calls) {
    const name = methodName(call);
    const bag = optionsBag(call);
    const pushNode = (keyExpression, providerExpression) => {
      const { inner, lifetime, owned } = unwrap(providerExpression, checker, declarationOwners);
      const { dependencies, async } = describeFactory(inner, checker);
      const { line } = sourceFile.getLineAndCharacterOfPosition(call.getStart(sourceFile));
      nodes.push({ key: keyText(keyExpression), line: line + 1, dependencies, async, lifetime, owned });
    };
    if (name === 'withServiceAlias' && bag) {
      const from = bagProperty(bag, 'aliasKey'), to = bagProperty(bag, 'targetServiceKey');
      if (from && to) aliases.push({ from: keyText(from), to: keyText(to) });
    } else if (name === 'withInstalledModules' && call.arguments.length === 1) {
      installs.push(...listedModules(call.arguments[0], checker));
    } else if (name === 'buildModule' && bag && !ts.isArrayLiteralExpression(call.arguments[0])) {
      const keys = bagProperty(bag, 'exportedServiceKeys');
      if (keys && ts.isArrayLiteralExpression(skipOuter(keys))) exports = skipOuter(keys).elements.map(keyText);
      const moduleLabel = bagProperty(bag, 'moduleLabel');
      if (moduleLabel && ts.isStringLiteralLike(moduleLabel)) label = moduleLabel.text;
    } else if ((name === 'register' || name === 'replace' || name === 'withServices') && call.arguments.length === 1 && ts.isObjectLiteralExpression(call.arguments[0])) {
      for (const property of call.arguments[0].properties) {
        if (!ts.isPropertyAssignment(property) && !ts.isShorthandPropertyAssignment(property)) continue;
        let provider = ts.isPropertyAssignment(property) ? property.initializer : property.name;
        if (ts.isShorthandPropertyAssignment(property)) {
          const value = checker.getShorthandAssignmentValueSymbol(property)?.valueDeclaration;
          if (value && ts.isVariableDeclaration(value) && value.initializer) provider = value.initializer;
        }
        const { inner, lifetime, owned } = unwrap(provider, checker, declarationOwners);
        const { dependencies, async } = describeFactory(inner, checker);
        const { line } = sourceFile.getLineAndCharacterOfPosition(property.getStart(sourceFile));
        nodes.push({ key: keyText(property.name), line: line + 1, dependencies, async, lifetime, owned });
      }
    } else if (['register', 'replace', 'withTokenService', 'withReplacedService'].includes(name) && call.arguments.length === 2) {
      pushNode(call.arguments[0], call.arguments[1]);
    } else if ((name === 'alias' || name === 'withServiceAlias') && call.arguments.length === 2) {
      aliases.push({ from: keyText(call.arguments[0]), to: keyText(call.arguments[1]) });
    } else if ((name === 'installModule' || name === 'withInstalledModule') && call.arguments.length === 1) {
      installs.push(call.arguments[0]);
    } else if (name === 'buildModule' && call.arguments[0] && ts.isArrayLiteralExpression(call.arguments[0])) {
      exports = call.arguments[0].elements.map(keyText);
      const options = call.arguments[1];
      const property = options && ts.isObjectLiteralExpression(options)
        ? options.properties.find(candidate => ts.isPropertyAssignment(candidate) && keyText(candidate.name) === 'label') : undefined;
      if (property && ts.isStringLiteralLike(property.initializer)) label = property.initializer.text;
    }
  }
  const { line } = sourceFile.getLineAndCharacterOfPosition(calls[0].getStart(sourceFile));
  const file = relative(root, sourceFile.fileName);
  const kind = methodName(terminal) === 'buildModule' ? 'module' : 'bag';
  return { id: `${file}:${line + 1}`, kind, file, line: line + 1, ...(label === undefined ? {} : { label }), exports, installs, nodes, aliases, terminal };
}

/** Map each install argument to its module and ordered literal view renames. */
function resolveInstalls(units, checker) {
  const byTerminal = new Map(units.map(unit => [unit.terminal, unit]));
  for (const unit of units) {
    unit.installRefs = unit.installs.map(argument => {
      const view = moduleView(argument);
      const initializer = ts.isIdentifier(view.expression) ? initializerOf(view.expression, checker) : view.expression;
      const target = initializer && byTerminal.get(skipOuter(initializer));
      return {
        unit: target?.kind === 'module' ? target : undefined,
        label: view.expression.getText(),
        exportRenames: view.exportRenames,
        requirementRenames: view.requirementRenames,
      };
    });
    unit.installs = unit.installRefs.map((ref, index) => ref.unit?.id ?? unit.installs[index].getText());
  }
  for (const unit of units) delete unit.terminal;
}

/**
 * Add a unit's nodes to `graph` under `prefix`, installing modules under `<prefix><label>/`.
 * A name no scope supplies resolves through `outer`, the installing host's lookup.
 * @returns The unit's own lookup, which never consults the host.
 */
function instantiate(unit, prefix, outer, graph, active) {
  const local = new Set(unit.nodes.map(node => node.key));
  const aliases = new Map(unit.aliases.map(alias => [alias.from, alias.to]));
  let opaque = false;
  const installed = [];
  for (const ref of unit.installRefs) {
    if (!ref.unit || active.has(ref.unit)) { opaque = true; continue; }
    const exported = new Map(ref.unit.exports.map(key => [key, key]));
    for (const [from, to] of ref.exportRenames) {
      if (exported.has(from)) { exported.set(to, exported.get(from)); exported.delete(from); }
    }
    const requirements = new Map();
    for (const [from, to] of ref.requirementRenames) {
      const original = [...requirements].find(([, current]) => current === from)?.[0] ?? from;
      requirements.set(original, to);
    }
    active.add(ref.unit);
    // The module's own label matches runtime messages; the install expression names unlabeled modules.
    const own = instantiate(ref.unit, `${prefix}${ref.unit.label ?? ref.label}/`, name => lookup(requirements.get(name) ?? name), graph, active);
    active.delete(ref.unit);
    installed.push({ exported, own });
  }
  // Returns { id } for a node, { opaque: true } when an untraceable install may supply the name, or undefined.
  const own = (name, seen = new Set()) => {
    if (local.has(name)) return { id: prefix + name };
    if (aliases.has(name) && !seen.has(name)) return own(aliases.get(name), seen.add(name));
    for (const install of installed) if (install.exported.has(name)) return install.own(install.exported.get(name));
    return opaque ? { opaque: true } : undefined;
  };
  const lookup = name => {
    const found = own(name);
    if (found?.id !== undefined) return found;
    const supplied = outer?.(name);
    if (supplied?.id !== undefined || supplied?.opaque) return supplied;
    return found ?? supplied ?? { requirement: name };
  };
  // Resolved after every install exists: a requirement may name a module installed later.
  const top = prefix ? prefix.split('/')[0] : '';
  for (const node of unit.nodes) {
    graph.set(prefix + node.key, { top, dependencies: node.dependencies.map(name => ({ name, lookup })) });
  }
  return own;
}

function findIssues(units) {
  const issues = [];
  for (const unit of units) {
    const graph = new Map();
    instantiate(unit, '', undefined, graph, new Set([unit]));
    for (const node of graph.values()) for (const dependency of node.dependencies) dependency.target = dependency.lookup(dependency.name);
    // Depth-first search; a cycle inside one installed module is reported by that module's own unit.
    const state = new Map();
    const stack = [];
    const visit = id => {
      state.set(id, 'active'); stack.push(id);
      for (const { target } of graph.get(id).dependencies) {
        if (!target?.id) continue;
        if (state.get(target.id) === 'active') {
          const path = [...stack.slice(stack.indexOf(target.id)), target.id];
          const tops = new Set(path.map(step => graph.get(step).top));
          if (!(tops.size === 1 && !tops.has(''))) issues.push({ kind: 'cycle', unit: unit.id, path });
        } else if (!state.has(target.id)) visit(target.id);
      }
      stack.pop(); state.set(id, 'done');
    };
    for (const id of graph.keys()) if (!state.has(id)) visit(id);
    const unmet = [...graph].flatMap(([id, node]) => node.dependencies
      .filter(dependency => dependency.target.requirement !== undefined)
      .map(({ name, target }) => ({ id, name, requirement: target.requirement })));
    // A module's unmet names are requirements the host supplies; only a bag reports them as issues.
    if (unit.kind === 'module') unit.requirements = [...new Set(unmet.map(({ requirement }) => requirement))].sort();
    else for (const { id, name } of unmet) issues.push({ kind: 'unresolved', unit: unit.id, consumer: id, dependency: name });
    unit.edges = unit.nodes.flatMap(node => node.dependencies.map(dependency => ({ from: node.key, to: dependency })))
      .sort((left, right) => left.from.localeCompare(right.from) || left.to.localeCompare(right.to));
  }
  for (const unit of units) { delete unit.aliases; delete unit.installRefs; }
  return issues;
}

/**
 * Extract every DI Bag builder chain in a project or file list.
 * @param {{ project?: string, files?: string[], root?: string, typescript?: typeof import('typescript') }} input -
 *   A tsconfig path or files, resolved against `root`; `typescript` defaults to {@link loadTypeScript}.
 */
export function extractDependencyGraph({ project, files, root = process.cwd(), typescript }) {
  if (!project && !files?.length) throw new Error('extractDependencyGraph requires a project or files');
  ts = typescript ?? loadTypeScript(project ? dirname(resolve(root, project)) : root).ts;
  const program = loadProgram({ project, files, root });
  const checker = program.getTypeChecker();
  const units = [];
  for (const sourceFile of program.getSourceFiles()) {
    if (sourceFile.isDeclarationFile || sourceFile.fileName.includes('/node_modules/')) continue;
    const declarationOwners = diBagDeclarationOwners(sourceFile, checker);
    const visit = node => {
      if (ts.isCallExpression(node) && TERMINALS.has(methodName(node) ?? '') && isChainStart(chainCalls(node, checker))) {
        units.push(readUnit(node, sourceFile, checker, declarationOwners, root));
        return;
      }
      ts.forEachChild(node, visit);
    };
    visit(sourceFile);
  }
  resolveInstalls(units, checker);
  const issues = findIssues(units);
  return { version: 1, units, issues };
}
