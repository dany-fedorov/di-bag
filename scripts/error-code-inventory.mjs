// Lists DI_BAG_ code literals at recognized throw and diagnostic call sites.
// It exits 1 when a literal cannot be classified or a DI_BAG_INVALID_ARGUMENT site lacks required detail keys.
import { readdirSync, readFileSync, writeSync } from 'node:fs';
import { createRequire } from 'node:module';
import { join } from 'node:path';

const require = createRequire(import.meta.url);
const ts = require('typescript');
const root = process.argv[2] ?? 'src';
const literal = /'(DI_BAG_[A-Z_]+)'/g;
const exactLiteral = /^'(DI_BAG_[A-Z_]+)'$/;
const supportedCalls = new Map([
  ['libraryError', { code: 0, message: 1, details: 2 }],
  ['libraryTypeError', { code: 0, message: 1, details: 2 }],
  ['diagnosticMessage', { code: 0, message: 1 }],
  ['diagnostic', { code: 1 }],
  ['snapshotOptions', { code: 2 }],
]);
const rows = [];
let found = 0;
let accounted = 0;

function walk(node, visit) {
  visit(node);
  ts.forEachChild(node, child => walk(child, visit));
}

function codeLiterals(node, sourceFile) {
  const literals = [];
  walk(node, child => {
    if (!ts.isStringLiteral(child)) return;
    const code = exactLiteral.exec(child.getText(sourceFile))?.[1];
    if (code) literals.push({ node: child, code });
  });
  return literals.sort((left, right) => left.node.getStart(sourceFile) - right.node.getStart(sourceFile));
}

function templateText(node, sourceFile) {
  if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) return node.text;
  if (!ts.isTemplateExpression(node)) return '';
  return node.head.text + node.templateSpans.map(span => `\u0024{${span.expression.getText(sourceFile)}}${span.literal.text}`).join('');
}

function propertyKey(property, sourceFile) {
  if (ts.isShorthandPropertyAssignment(property)) return property.name.text;
  if (!ts.isPropertyAssignment(property)) return undefined;
  const name = property.name;
  if (ts.isIdentifier(name) || ts.isStringLiteral(name) || ts.isNumericLiteral(name) || ts.isNoSubstitutionTemplateLiteral(name)) return name.text;
  return name.getText(sourceFile);
}

function missingDetails(call, descriptor, sourceFile) {
  if (descriptor.details === undefined) return undefined;
  const argumentNode = call.arguments[descriptor.details];
  const keys = new Set();
  if (argumentNode && ts.isObjectLiteralExpression(argumentNode)) {
    for (const property of argumentNode.properties) {
      const key = propertyKey(property, sourceFile);
      if (key !== undefined) keys.add(key);
    }
  }
  return ['operation', 'argument', 'expected'].filter(key => !keys.has(key));
}

for (const file of readdirSync(root).filter(name => name.endsWith('.ts')).sort()) {
  const filePath = join(root, file);
  const text = readFileSync(filePath, 'utf8');
  const sourceFile = ts.createSourceFile(filePath, text, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
  const comments = [];
  const scanner = ts.createScanner(ts.ScriptTarget.Latest, false, ts.LanguageVariant.Standard, text);
  for (let token = scanner.scan(); token !== ts.SyntaxKind.EndOfFileToken; token = scanner.scan()) {
    if (token === ts.SyntaxKind.SingleLineCommentTrivia || token === ts.SyntaxKind.MultiLineCommentTrivia) {
      comments.push({ start: scanner.getTokenPos(), end: scanner.getTextPos() });
    }
  }

  const rawMatches = [...text.matchAll(literal)].map(match => ({ code: match[1], start: match.index ?? 0 }));
  found += rawMatches.length;
  const astCodes = [];
  walk(sourceFile, node => {
    if (!ts.isStringLiteral(node)) return;
    const code = exactLiteral.exec(node.getText(sourceFile))?.[1];
    if (code) astCodes.push({ node, code, start: node.getStart(sourceFile), end: node.end });
  });

  const classified = new Set();
  const commentMatches = rawMatches.filter(match => comments.some(comment => comment.start <= match.start && match.start < comment.end));
  accounted += commentMatches.length;
  for (const commentMatch of commentMatches) classified.add(commentMatch.start);

  const rowByNode = new Map();
  walk(sourceFile, node => {
    if (!ts.isCallExpression(node) || !ts.isIdentifier(node.expression)) return;
    const owner = node.expression.text;
    const descriptor = supportedCalls.get(owner);
    if (!descriptor) return;
    const codeArgument = node.arguments[descriptor.code];
    if (!codeArgument) return;
    const matches = codeLiterals(codeArgument, sourceFile);
    if (!matches.length) return;
    const start = matches[0].node.getStart(sourceFile);
    const line = sourceFile.getLineAndCharacterOfPosition(start).line + 1;
    const messageArgument = descriptor.message === undefined ? undefined : node.arguments[descriptor.message];
    const row = {
      file: `${root}/${file}`,
      line,
      owner,
      codes: matches.map(match => match.code),
      message: messageArgument ? templateText(messageArgument, sourceFile) : '',
    };
    if (row.codes.includes('DI_BAG_INVALID_ARGUMENT')) {
      row.missingDetails = missingDetails(node, descriptor, sourceFile) ?? ['operation', 'argument', 'expected'];
    }
    rows.push({ row, start });
    for (const match of matches) {
      rowByNode.set(match.node, true);
      const raw = rawMatches.find(item => item.start === match.node.getStart(sourceFile));
      if (raw) classified.add(raw.start);
    }
    accounted += matches.length;
  });

  // Keep named code aliases visible without attaching nearby literals to an unrelated call.
  walk(sourceFile, node => {
    if (!ts.isVariableDeclaration(node) || !ts.isIdentifier(node.name) || node.name.text !== 'code' || !node.initializer) return;
    const matches = codeLiterals(node.initializer, sourceFile).filter(match => !rowByNode.has(match.node));
    if (!matches.length) return;
    const start = matches[0].node.getStart(sourceFile);
    rows.push({ row: { file: `${root}/${file}`, line: sourceFile.getLineAndCharacterOfPosition(start).line + 1, owner: 'code variable', codes: matches.map(match => match.code), message: '' }, start });
    for (const match of matches) {
      rowByNode.set(match.node, true);
      const raw = rawMatches.find(item => item.start === match.node.getStart(sourceFile));
      if (raw) classified.add(raw.start);
    }
    accounted += matches.length;
  });

  for (const match of rawMatches) {
    if (classified.has(match.start)) continue;
    const astLiteral = astCodes.find(candidate => candidate.start <= match.start && match.start < candidate.end);
    if (astLiteral && ts.isLiteralTypeNode(astLiteral.node.parent)) {
      accounted++;
      classified.add(match.start);
      continue;
    }
    const line = text.slice(0, match.start).split('\n').length;
    rows.push({ row: { file: `${root}/${file}`, line, owner: 'UNCLASSIFIED', codes: [match.code], message: '' }, start: match.start });
    accounted++;
    classified.add(match.start);
  }
}

rows.sort((left, right) => left.row.file.localeCompare(right.row.file) || left.start - right.start);
const outputRows = rows.map(item => item.row);
const unclassified = outputRows.filter(row => row.owner === 'UNCLASSIFIED');
const incomplete = outputRows.filter(row => row.missingDetails?.length);
if (process.argv.includes('--json')) writeSync(1, `${JSON.stringify(outputRows, null, 2)}\n`);
else for (const row of outputRows) writeSync(1, `${[row.file, row.line, row.owner, row.codes.join('|'), row.message].join('\t')}\n`);
writeSync(2, `literals: ${found}; accounted: ${accounted}; rows: ${outputRows.length}; codes: ${new Set(outputRows.flatMap(row => row.codes)).size}; unclassified: ${unclassified.length}; incomplete details: ${incomplete.length}\n`);
process.exitCode = found === accounted && unclassified.length === 0 && incomplete.length === 0 ? 0 : 1;
