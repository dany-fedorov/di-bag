// tools/graph/lib/extract.mjs
import { relative, resolve } from 'node:path';
import ts from 'typescript';

const TERMINALS = new Set(['build', 'buildAndStart', 'buildModule']);
const WRAPPERS = new Set(['withLifetime', 'withDisposal', 'withMetadata', 'transformService']);

const defaultOptions = {
  strict: true, noEmit: true, skipLibCheck: true, types: [],
  target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.NodeNext, moduleResolution: ts.ModuleResolutionKind.NodeNext,
};

function loadProgram({ project, files, root }) {
  if (project) {
    const config = ts.getParsedCommandLineOfConfigFile(resolve(root, project), {}, {
      ...ts.sys, onUnRecoverableConfigFileDiagnostic: diagnostic => { throw new Error(ts.flattenDiagnosticMessageText(diagnostic.messageText, '\n')); },
    });
    return ts.createProgram(config.fileNames, { ...config.options, noEmit: true });
  }
  return ts.createProgram(files.map(file => resolve(root, file)), defaultOptions);
}

/** The property-access method name of a call such as `x.register(...)`, or undefined. */
function methodName(call) {
  return ts.isPropertyAccessExpression(call.expression) ? call.expression.name.text : undefined;
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
      const symbol = checker.getSymbolAtLocation(current);
      const declaration = symbol?.valueDeclaration;
      if (!declaration || !ts.isVariableDeclaration(declaration) || !declaration.initializer || seen.has(declaration)) break;
      seen.add(declaration);
      current = declaration.initializer;
    } else if (ts.isParenthesizedExpression(current)) {
      current = current.expression;
    } else break;
  }
  return calls.reverse();
}

function isChainStart(calls) {
  return calls.length > 0 && methodName(calls[0]) === 'createBuilder';
}

/** Unwrap DiBag decorators around a registration expression, reading lifetime and ownership on the way. */
function unwrap(expression) {
  let lifetime = 'scoped', owned = false, inner = expression;
  while (ts.isCallExpression(inner) && WRAPPERS.has(methodName(inner) ?? '') && inner.arguments.length > 0) {
    const name = methodName(inner);
    if (name === 'withLifetime' && inner.arguments[1] && ts.isStringLiteral(inner.arguments[1])) lifetime = inner.arguments[1].text;
    if (name === 'withDisposal') owned = true;
    inner = inner.arguments[0];
  }
  return { inner, lifetime, owned };
}

/** Declared named dependencies and async-ness of a factory expression, through the checker. */
function describeFactory(expression, checker) {
  let type = checker.getTypeAtLocation(expression);
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

function readUnit(terminal, sourceFile, checker, root, units) {
  const calls = chainCalls(terminal, checker);
  const nodes = [], installs = [], aliases = [];
  let exports = [];
  for (const call of calls) {
    const name = methodName(call);
    if ((name === 'register' || name === 'replace') && call.arguments.length === 1 && ts.isObjectLiteralExpression(call.arguments[0])) {
      for (const property of call.arguments[0].properties) {
        if (!ts.isPropertyAssignment(property)) continue;
        const { inner, lifetime, owned } = unwrap(property.initializer);
        const { dependencies, async } = describeFactory(inner, checker);
        const { line } = sourceFile.getLineAndCharacterOfPosition(property.getStart(sourceFile));
        nodes.push({ key: keyText(property.name), line: line + 1, dependencies, async, lifetime, owned });
      }
    } else if ((name === 'register' || name === 'replace') && call.arguments.length === 2) {
      const { inner, lifetime, owned } = unwrap(call.arguments[1]);
      const { dependencies, async } = describeFactory(inner, checker);
      const { line } = sourceFile.getLineAndCharacterOfPosition(call.getStart(sourceFile));
      nodes.push({ key: keyText(call.arguments[0]), line: line + 1, dependencies, async, lifetime, owned });
    } else if (name === 'alias' && call.arguments.length === 2) {
      aliases.push({ from: keyText(call.arguments[0]), to: keyText(call.arguments[1]) });
    } else if (name === 'installModule' && call.arguments.length === 1) {
      installs.push(call.arguments[0]);
    } else if (name === 'buildModule' && call.arguments[0] && ts.isArrayLiteralExpression(call.arguments[0])) {
      exports = call.arguments[0].elements.map(keyText);
    }
  }
  const { line } = sourceFile.getLineAndCharacterOfPosition(calls[0].getStart(sourceFile));
  const file = relative(root, sourceFile.fileName);
  return { id: `${file}:${line + 1}`, kind: methodName(terminal) === 'buildModule' ? 'module' : 'bag', file, line: line + 1, exports, installs, nodes, aliases, terminal };
}

/** Map each install argument to the unit whose terminal call initializes the referenced variable. */
function resolveInstalls(units, checker) {
  const byTerminal = new Map(units.map(unit => [unit.terminal, unit]));
  for (const unit of units) {
    unit.installs = unit.installs.map(argument => {
      let expression = argument;
      while (ts.isCallExpression(expression) && methodName(expression) === 'renameExport' && ts.isPropertyAccessExpression(expression.expression)) expression = expression.expression.expression;
      const symbol = ts.isIdentifier(expression) ? checker.getSymbolAtLocation(expression) : undefined;
      const initializer = symbol?.valueDeclaration && ts.isVariableDeclaration(symbol.valueDeclaration) ? symbol.valueDeclaration.initializer : undefined;
      return (initializer && byTerminal.get(initializer)?.id) ?? argument.getText();
    });
    delete unit.terminal;
  }
}

function findIssues(units) {
  const byId = new Map(units.map(unit => [unit.id, unit]));
  const issues = [];
  for (const unit of units) {
    const provided = new Set([...unit.nodes.map(node => node.key), ...unit.aliases.map(alias => alias.from)]);
    for (const install of unit.installs) for (const exported of byId.get(install)?.exports ?? []) provided.add(exported);
    const local = new Map(unit.nodes.map(node => [node.key, node.dependencies]));
    // Depth-first search over local edges first; report each cycle once at its first discovery.
    const state = new Map();
    const stack = [];
    const visit = key => {
      state.set(key, 'active'); stack.push(key);
      for (const dependency of local.get(key) ?? []) {
        if (state.get(dependency) === 'active') { issues.push({ kind: 'cycle', unit: unit.id, path: [...stack.slice(stack.indexOf(dependency)), dependency] }); continue; }
        if (!state.has(dependency) && local.has(dependency)) visit(dependency);
      }
      stack.pop(); state.set(key, 'done');
    };
    for (const node of unit.nodes) if (!state.has(node.key)) visit(node.key);
    // A module's unmet names are requirements the host supplies; only a bag reports them as issues.
    const unmet = [...new Set(unit.nodes.flatMap(node => node.dependencies.filter(dependency => !provided.has(dependency))))].sort();
    if (unit.kind === 'module') unit.requirements = unmet;
    else for (const node of unit.nodes) for (const dependency of node.dependencies) {
      if (!provided.has(dependency)) issues.push({ kind: 'unresolved', unit: unit.id, consumer: node.key, dependency });
    }
    unit.edges = unit.nodes.flatMap(node => node.dependencies.map(dependency => ({ from: node.key, to: dependency })))
      .sort((left, right) => left.from.localeCompare(right.from) || left.to.localeCompare(right.to));
    delete unit.aliases;
  }
  return issues;
}

/**
 * Extract every DI Bag builder chain in a project or file list.
 * @param {{ project?: string, files?: string[], root?: string }} input - A tsconfig path or files, resolved against `root`.
 */
export function extractDependencyGraph({ project, files, root = process.cwd() }) {
  if (!project && !files?.length) throw new Error('extractDependencyGraph requires a project or files');
  const program = loadProgram({ project, files, root });
  const checker = program.getTypeChecker();
  const units = [];
  for (const sourceFile of program.getSourceFiles()) {
    if (sourceFile.isDeclarationFile || sourceFile.fileName.includes('/node_modules/')) continue;
    const visit = node => {
      if (ts.isCallExpression(node) && TERMINALS.has(methodName(node) ?? '') && isChainStart(chainCalls(node, checker))) {
        units.push(readUnit(node, sourceFile, checker, root, units));
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
