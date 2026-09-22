// tools/codemod/lib/transforms/collection-tokens.mjs
const COLLECTION_POSITIONS = new Set(['Builder.contribute', 'DiBagApi.all', 'Bag.resolveAll', 'Bag.inspectAll']);
const analyses = new WeakMap();

function analyze(api) {
  const { ts, checker, program, library } = api;
  let analysis = analyses.get(program);
  if (analysis) return analysis;
  analysis = new Map();
  analyses.set(program, analysis);
  const files = program.getSourceFiles().filter(file =>
    !file.isDeclarationFile && !library.isLibraryFile(file.fileName) && !file.fileName.includes('/node_modules/'));
  const visitDeclarations = node => {
    if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name) && node.initializer && isTokenCreation(api, node.initializer)) {
      const symbol = checker.getSymbolAtLocation(node.name);
      if (symbol) {
        analysis.set(symbol, { declaration: node, creation: node.initializer, collectionUses: [], otherUses: [] });
      }
    }
    ts.forEachChild(node, visitDeclarations);
  };
  for (const file of files) visitDeclarations(file);
  const visitUses = node => {
    if (ts.isIdentifier(node)) {
      const entry = analysis.get(variableSymbol(api, node));
      if (entry && node !== entry.declaration.name) {
        const use = classify(api, node);
        if (use === 'collection') entry.collectionUses.push(node);
        else if (use === 'other') entry.otherUses.push(node);
      }
    }
    ts.forEachChild(node, visitUses);
  };
  for (const file of files) visitUses(file);
  return analysis;
}

function isTokenCreation(api, node) {
  const { ts, library } = api;
  if (!ts.isCallExpression(node) || !ts.isPropertyAccessExpression(node.expression)) return false;
  const coverage = library.memberCoverage(library.symbolAt(node.expression.name));
  return coverage.complete && coverage.members.length > 0
    && coverage.members.every(member => member.owner === 'token()' && member.name === 'of');
}

function variableSymbol(api, identifier) {
  const { ts, checker } = api;
  const parent = identifier.parent;
  let symbol = ts.isShorthandPropertyAssignment(parent) ? checker.getShorthandAssignmentValueSymbol(parent)
    : ts.isExportSpecifier(parent) ? checker.getExportSpecifierLocalTargetSymbol(parent)
    : checker.getSymbolAtLocation(identifier);
  if (symbol && symbol.flags & ts.SymbolFlags.Alias) symbol = checker.getAliasedSymbol(symbol);
  return symbol;
}

function classify(api, identifier) {
  const { ts, library } = api;
  const parent = identifier.parent;
  if (ts.isImportSpecifier(parent) || ts.isExportSpecifier(parent) || ts.isImportClause(parent) || ts.isTypeQueryNode(parent)) return 'neutral';
  if (ts.isPropertyAccessExpression(parent) && parent.expression === identifier && parent.name.text === 'key') return 'neutral';
  if (ts.isCallExpression(parent) && parent.arguments[0] === identifier && ts.isPropertyAccessExpression(parent.expression)) {
    const coverage = library.memberCoverage(library.symbolAt(parent.expression.name));
    if (coverage.complete && coverage.members.length > 0
        && coverage.members.every(member => COLLECTION_POSITIONS.has(`${member.owner}.${member.name}`))) {
      return 'collection';
    }
  }
  return 'other';
}

export function tokenUse(api, expression) {
  const { ts } = api;
  if (!ts.isIdentifier(expression)) return { state: 'untraceable' };
  const entry = analyze(api).get(variableSymbol(api, expression));
  if (!entry) return { state: 'untraceable' };
  return describe(expression.text, entry);
}

export function creationUse(api, call) {
  const { ts, checker } = api;
  const declaration = call.parent;
  if (!ts.isVariableDeclaration(declaration) || declaration.initializer !== call || !ts.isIdentifier(declaration.name)) {
    return { state: 'untraceable' };
  }
  const entry = analyze(api).get(checker.getSymbolAtLocation(declaration.name));
  return entry ? describe(declaration.name.text, entry) : { state: 'untraceable' };
}

function describe(name, entry) {
  if (entry.collectionUses.length === 0) return { state: 'single', name };
  if (entry.otherUses.length > 0) return { state: 'mixed', name, otherUse: entry.otherUses[0] };
  return { state: 'collection', name };
}

export function locate(node) {
  const file = node.getSourceFile();
  return `${file.fileName.split('/').slice(-2).join('/')}:${file.getLineAndCharacterOfPosition(node.getStart(file)).line + 1}`;
}
