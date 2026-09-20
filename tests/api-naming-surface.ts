// tests/api-naming-surface.ts
// Scans the public surface for the mechanical rules of docs/guides/api-naming.md.
// The public surface is every declaration reachable from the exports of src/index.ts through
// type references: exported names, member names, parameter names and string values. Bodies,
// constructors' plain parameters, private members, #private names, symbol-keyed members and
// members tagged @internal are not public.
import { readdirSync, readFileSync } from 'node:fs';
import { resolve, sep } from 'node:path';
import ts from 'typescript';
import { compilerProgram } from './compiler';

export type Rule = 'builder-method-prefix' | 'boolean-name' | 'abbreviation' | 'value-casing' | 'retired-word';
export interface Finding {
  /** Stable identity used by the known-violations list: `<rule>: <subject>`. It never names an owner, so renaming an owner does not move a violation. */
  readonly id: string;
  readonly rule: Rule;
  /** First place the subject was seen; for messages only. */
  readonly where: string;
}

/** Rule 7 of the naming guide. Matched against whole words of an identifier. */
export const abbreviations: ReadonlySet<string> = new Set(['ctx', 'deps', 'opts', 'cfg']);
/** The mechanically checkable retired words of the naming guide's vocabulary table. Matched against whole words. */
export const retiredWords: ReadonlySet<string> = new Set([
  'cleanup', 'startup', 'start', 'bag', 'root', 'family', 'scope', 'fork', 'mode', 'direct', 'awaited', 'all',
]);
/** Rule 6: a boolean name asserts something, so one of its words is one of these verbs. */
export const assertionVerbs: ReadonlySet<string> = new Set(['is', 'has', 'allows', 'receives']);
const builderPrefix = /^(with|build|verify)/;
const kebab = '[a-z][a-z0-9]*(?:-[a-z0-9]+)*';
const valuePattern = new RegExp(`^${kebab}(?::${kebab})?$`);
const codePattern = /^DI_BAG_[A-Z0-9]+(?:_[A-Z0-9]+)*$/;

/** Lower-case words of an identifier, a kebab-case value or a code. The product prefix `DiBag` is not a word. */
export function words(identifier: string): string[] {
  return identifier.replace(/^DiBag/, '')
    .split(/(?<=[a-z0-9])(?=[A-Z])|(?<=[A-Z])(?=[A-Z][a-z])|[_\-:\s]+/)
    .filter(Boolean)
    .map(word => word.toLowerCase());
}

export function collectFindings(root: string): Finding[] {
  const sourceDirectory = resolve(root, 'src');
  const sourceRoot = sourceDirectory + sep;
  const indexPath = resolve(sourceDirectory, 'index.ts');
  const program = compilerProgram(indexPath);
  const checker = program.getTypeChecker();
  const index = program.getSourceFile(indexPath);
  if (!index) throw new Error(`cannot load ${indexPath}`);
  const moduleSymbol = checker.getSymbolAtLocation(index);
  if (!moduleSymbol) throw new Error(`${indexPath} has no exports`);

  const findings = new Map<string, Finding>();
  const add = (rule: Rule, subject: string, where: string) => {
    const id = `${rule}: ${subject}`;
    if (!findings.has(id)) findings.set(id, { id, rule, where });
  };
  const checkName = (kind: 'export' | 'member' | 'parameter', name: string, where: string) => {
    for (const word of words(name)) {
      if (retiredWords.has(word)) add('retired-word', `${kind} ${name}`, where);
      if (abbreviations.has(word)) add('abbreviation', `${kind} ${name}`, where);
    }
  };
  const checkValue = (value: string, where: string) => {
    if (!/^[A-Za-z0-9_:-]+$/.test(value)) return; // prose or a URL inside a diagnostic, not a value anyone passes
    if (value.startsWith('DI_BAG_')) return; // codes are checked from the source text below
    if (!valuePattern.test(value)) add('value-casing', `value '${value}'`, where);
    if (words(value).some(word => retiredWords.has(word))) add('retired-word', `value '${value}'`, where);
  };

  const resolveSymbol = (symbol: ts.Symbol | undefined): ts.Symbol | undefined =>
    symbol && symbol.flags & ts.SymbolFlags.Alias ? checker.getAliasedSymbol(symbol) : symbol;
  const inLibrary = (node: ts.Node) => node.getSourceFile().fileName.startsWith(sourceRoot);
  const seen = new Set<ts.Node>();
  const hasModifier = (node: ts.Node, kind: ts.SyntaxKind) =>
    ts.canHaveModifiers(node) && (ts.getModifiers(node) ?? []).some(modifier => modifier.kind === kind);
  const isHidden = (node: ts.Node) =>
    hasModifier(node, ts.SyntaxKind.PrivateKeyword) || hasModifier(node, ts.SyntaxKind.ProtectedKeyword) ||
    ts.getJSDocTags(node).some(tag => tag.tagName.text === 'internal');
  const plainName = (name: ts.PropertyName | ts.BindingName | undefined): string | undefined =>
    name && (ts.isIdentifier(name) || ts.isStringLiteral(name)) ? name.text : undefined;

  const isBooleanish = (node: ts.TypeNode): boolean => {
    if (node.kind === ts.SyntaxKind.BooleanKeyword) return true;
    if (ts.isLiteralTypeNode(node)) return node.literal.kind === ts.SyntaxKind.TrueKeyword || node.literal.kind === ts.SyntaxKind.FalseKeyword;
    if (ts.isParenthesizedTypeNode(node)) return isBooleanish(node.type);
    if (ts.isUnionTypeNode(node)) {
      const parts = node.types.filter(part => part.kind !== ts.SyntaxKind.UndefinedKeyword);
      return parts.length > 0 && parts.every(isBooleanish);
    }
    if (ts.isConditionalTypeNode(node)) return isBooleanish(node.trueType) && isBooleanish(node.falseType);
    return false;
  };
  const stringValues = (node: ts.TypeNode | undefined): string[] => {
    if (!node) return [];
    if (ts.isLiteralTypeNode(node) && ts.isStringLiteral(node.literal)) return [node.literal.text];
    if (ts.isParenthesizedTypeNode(node)) return stringValues(node.type);
    if (ts.isUnionTypeNode(node)) return node.types.flatMap(stringValues);
    return [];
  };
  const checkTyped = (name: string, type: ts.TypeNode | undefined, where: string) => {
    if (!type) return;
    if (isBooleanish(type) && !words(name).some(word => assertionVerbs.has(word))) add('boolean-name', `member ${name}`, where);
    for (const value of stringValues(type)) checkValue(value, where);
  };

  function visitSymbol(symbol: ts.Symbol | undefined) {
    for (const declaration of resolveSymbol(symbol)?.declarations ?? []) if (inLibrary(declaration)) visitDeclaration(declaration);
  }

  function visitType(node: ts.Node | undefined, owner: string) {
    if (!node) return;
    if (ts.isTypeReferenceNode(node)) visitSymbol(checker.getSymbolAtLocation(node.typeName));
    else if (ts.isExpressionWithTypeArguments(node)) visitSymbol(checker.getSymbolAtLocation(node.expression));
    else if (ts.isTypeQueryNode(node)) visitSymbol(checker.getSymbolAtLocation(node.exprName));
    else if (ts.isImportTypeNode(node) && node.qualifier) visitSymbol(checker.getSymbolAtLocation(node.qualifier));
    if (ts.isTypeLiteralNode(node)) { for (const member of node.members) visitMember(member, owner); return; }
    if (ts.isFunctionTypeNode(node) || ts.isConstructorTypeNode(node)) { visitSignature(node, owner); return; }
    ts.forEachChild(node, child => visitType(child, owner));
  }

  function visitTypeParameters(parameters: ts.NodeArray<ts.TypeParameterDeclaration> | undefined, owner: string) {
    for (const parameter of parameters ?? []) { visitType(parameter.constraint, owner); visitType(parameter.default, owner); }
  }

  function visitSignature(node: ts.SignatureDeclarationBase, owner: string) {
    visitTypeParameters(node.typeParameters, owner);
    for (const parameter of node.parameters) {
      const name = plainName(parameter.name);
      if (name !== undefined && name !== 'this') {
        checkName('parameter', name, owner);
        for (const value of stringValues(parameter.type)) checkValue(value, `${owner}(${name})`);
      }
      visitType(parameter.type, owner);
    }
    visitType(node.type, owner);
  }

  function visitMember(member: ts.Node, owner: string) {
    if (isHidden(member)) return;
    if (ts.isConstructorDeclaration(member)) {
      // Only parameter properties are members; the constructor itself is not a public call.
      for (const parameter of member.parameters) {
        const name = plainName(parameter.name);
        const isProperty = hasModifier(parameter, ts.SyntaxKind.ReadonlyKeyword) || hasModifier(parameter, ts.SyntaxKind.PublicKeyword);
        if (name === undefined || !isProperty || isHidden(parameter)) continue;
        checkName('member', name, `${owner}.${name}`);
        checkTyped(name, parameter.type, `${owner}.${name}`);
        visitType(parameter.type, `${owner}.${name}`);
      }
      return;
    }
    if (ts.isCallSignatureDeclaration(member) || ts.isConstructSignatureDeclaration(member) || ts.isIndexSignatureDeclaration(member)) {
      visitSignature(member, owner);
      return;
    }
    if (!ts.isPropertySignature(member) && !ts.isPropertyDeclaration(member) && !ts.isMethodSignature(member) &&
      !ts.isMethodDeclaration(member) && !ts.isGetAccessorDeclaration(member)) return;
    const name = plainName(member.name);
    if (name === undefined) return; // #private names and symbol-keyed invariants are not public names
    const where = `${owner}.${name}`;
    if (ts.isMethodDeclaration(member) && member.body) {
      const siblings = (member.parent as ts.ClassLikeDeclaration).members;
      // The implementation signature of an overload set is not public.
      if (siblings.some(other => other !== member && ts.isMethodDeclaration(other) && !other.body && plainName(other.name) === name)) return;
    }
    checkName('member', name, where);
    if (ts.isMethodSignature(member) || ts.isMethodDeclaration(member) || ts.isGetAccessorDeclaration(member)) { visitSignature(member, where); return; }
    checkTyped(name, member.type, where);
    visitType(member.type, where);
  }

  function visitDeclaration(declaration: ts.Declaration) {
    if (seen.has(declaration)) return;
    seen.add(declaration);
    if (ts.isClassDeclaration(declaration) || ts.isInterfaceDeclaration(declaration)) {
      const owner = declaration.name?.text ?? '(anonymous)';
      visitTypeParameters(declaration.typeParameters, owner);
      for (const clause of declaration.heritageClauses ?? []) for (const type of clause.types) visitType(type, owner);
      for (const member of declaration.members) visitMember(member, owner);
    } else if (ts.isTypeAliasDeclaration(declaration)) {
      const owner = declaration.name.text;
      visitTypeParameters(declaration.typeParameters, owner);
      for (const value of stringValues(declaration.type)) checkValue(value, owner);
      visitType(declaration.type, owner);
    } else if (ts.isFunctionDeclaration(declaration)) {
      const owner = declaration.name?.text ?? '(anonymous)';
      const symbol = declaration.name && checker.getSymbolAtLocation(declaration.name);
      const overloads = (symbol?.declarations ?? []).filter(ts.isFunctionDeclaration);
      if (declaration.body && overloads.some(other => !other.body)) return; // implementation of an overload set
      visitSignature(declaration, owner);
    } else if (ts.isVariableDeclaration(declaration)) {
      visitType(declaration.type, plainName(declaration.name) ?? '(variable)');
    }
  }

  const exported = checker.getExportsOfModule(moduleSymbol);
  for (const symbol of exported) {
    checkName('export', symbol.name, `export ${symbol.name}`);
    visitSymbol(symbol);
  }

  const builder = resolveSymbol(exported.find(symbol => symbol.name === 'Builder'))?.declarations?.find(ts.isClassDeclaration);
  if (!builder) throw new Error(`${indexPath} must export the Builder class`);
  for (const member of builder.members) {
    if (!ts.isMethodDeclaration(member) && !ts.isPropertyDeclaration(member)) continue;
    if (isHidden(member) || hasModifier(member, ts.SyntaxKind.StaticKeyword)) continue;
    const name = plainName(member.name);
    if (name === undefined) continue;
    const callable = ts.isMethodDeclaration(member) || checker.getTypeAtLocation(member).getCallSignatures().length > 0;
    if (callable && !builderPrefix.test(name)) add('builder-method-prefix', name, `Builder.${name}`);
  }

  // Runtime codes live in calls, not in types, so they are read from the source text.
  for (const file of readdirSync(sourceDirectory).filter(name => name.endsWith('.ts')).sort()) {
    for (const [, code] of readFileSync(resolve(sourceDirectory, file), 'utf8').matchAll(/'(DI_BAG_[A-Za-z0-9_]*)'/g)) {
      if (!codePattern.test(code!)) add('value-casing', `code ${code}`, `src/${file}`);
      if (words(code!.slice('DI_BAG_'.length)).some(word => retiredWords.has(word))) add('retired-word', `code ${code}`, `src/${file}`);
    }
  }
  return [...findings.values()].sort((left, right) => (left.id < right.id ? -1 : left.id > right.id ? 1 : 0));
}
