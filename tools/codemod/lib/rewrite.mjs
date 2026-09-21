// tools/codemod/lib/rewrite.mjs

// Members of built-in objects. A call such as `text.replace(...)` on an `any` receiver is not worth a report.
const BUILTIN_MEMBERS = new Set([String.prototype, Array.prototype, Promise.prototype, Promise, Object, Object.prototype, Map.prototype, Set.prototype]
  .flatMap(target => Object.getOwnPropertyNames(target)));
const IDENTIFIER = /^[A-Za-z_$][A-Za-z0-9_$]*$/;

/**
 * Rewrite one source file. Every decision reads the original program; the new text is
 * assembled bottom-up, so a rewritten call may contain other rewritten calls.
 * @returns {{ text: string, rewrites: number }}
 */
export function rewriteSourceFile({ ts, checker, sourceFile, library, index, transforms, manualItems, fileLabel }) {
  const source = sourceFile.text;
  const start = node => node.getStart(sourceFile);
  const slice = (from, to) => source.slice(from, to);
  const skip = new Set();
  let rewrites = 0;

  function manual(node, reason) {
    const { line, character } = sourceFile.getLineAndCharacterOfPosition(start(node));
    manualItems.push({ file: fileLabel, line: line + 1, column: character + 1, reason, text: slice(start(node), node.end).split('\n')[0].slice(0, 120) });
  }

  /** The transformed text of a node without its leading trivia. */
  function text(node) {
    const replaced = rewriteNode(node);
    if (replaced !== undefined) { rewrites++; return replaced; }
    return assemble(node, []);
  }

  /**
   * The text of `node` with `replacements` applied and every other child transformed.
   * Replacements are `{ start, end, text }` in file positions, inside the node, sorted and disjoint.
   * A child that contains replacements is assembled with them and is not offered to the handlers again.
   */
  function assemble(node, replacements) {
    const pending = [...replacements].sort((left, right) => left.start - right.start || left.end - right.end);
    const children = [];
    ts.forEachChild(node, child => { children.push(child); });
    let cursor = start(node);
    let out = '';
    const emit = replacement => { out += slice(cursor, replacement.start) + replacement.text; cursor = replacement.end; };
    for (const child of children) {
      const childStart = start(child);
      while (pending.length && pending[0].end <= childStart) emit(pending.shift());
      if (child.end <= cursor) continue;
      if (pending.length && pending[0].start <= childStart && pending[0].end >= child.end) continue;
      const inner = [];
      while (pending.length && pending[0].start >= childStart && pending[0].end <= child.end) inner.push(pending.shift());
      if (pending.length && pending[0].start < child.end) throw new Error(`overlapping rewrite in ${fileLabel} at offset ${pending[0].start}`);
      if (childStart < cursor) throw new Error(`children out of order in ${fileLabel} at offset ${childStart}`);
      out += slice(cursor, childStart) + (inner.length ? assemble(child, inner) : text(child));
      cursor = child.end;
    }
    while (pending.length) emit(pending.shift());
    return out + slice(cursor, node.end);
  }

  const quote = (literal, value) => {
    const delimiter = slice(start(literal), start(literal) + 1);
    return `${delimiter}${value.replaceAll(delimiter, `\\${delimiter}`)}${delimiter}`;
  };
  const keyText = (nameNode, key) => ts.isStringLiteral(nameNode) ? quote(nameNode, key) : IDENTIFIER.test(key) ? key : `'${key}'`;
  const isStringValue = node => ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node);
  const literalKey = property => property.name && (ts.isIdentifier(property.name) || ts.isStringLiteral(property.name)) ? property.name.text : undefined;

  /**
   * Rewrite the properties of an object literal.
   * `rename(key)` gives a new key; `value(key, current)` a new string value; `nested(key, literal)` the whole
   * text of a nested literal; `replace[key](property)` the whole property, `null` to drop it, `undefined` to give up.
   * @returns {{ text: string, changed: boolean, remaining: number } | undefined} undefined when a `replace` callback gave up.
   */
  function objectLiteral(literal, { rename = () => undefined, value = () => undefined, renamedValues = () => [], nested = () => undefined, replace = {}, spreadReason } = {}) {
    const replacements = [];
    const properties = literal.properties;
    let removed = 0;
    let previousRemoved = false;
    for (let position = 0; position < properties.length; position++) {
      const property = properties[position];
      const wasPreviousRemoved = previousRemoved;
      previousRemoved = false;
      if (ts.isSpreadAssignment(property)) { if (spreadReason) manual(property, spreadReason); continue; }
      const key = literalKey(property);
      if (key === undefined) continue;
      if (Object.hasOwn(replace, key)) {
        const result = replace[key](property);
        if (result === undefined) return undefined;
        if (result === null) {
          removed++;
          previousRemoved = true;
          if (position + 1 < properties.length) replacements.push({ start: start(property), end: start(properties[position + 1]), text: '' });
          else replacements.push({ start: position > 0 && !wasPreviousRemoved ? properties[position - 1].end : start(property), end: property.end, text: '' });
        } else replacements.push({ start: start(property), end: property.end, text: result });
        continue;
      }
      const newKey = rename(key, property);
      if (ts.isShorthandPropertyAssignment(property)) {
        if (newKey !== undefined && newKey !== key) replacements.push({ start: start(property), end: property.end, text: `${keyText(property.name, newKey)}: ${key}` });
        if (renamedValues(key).length) manual(property, `the value of ${key} is not a string literal; where it is produced, rename ${renamedValues(key).join(', ')}`);
        continue;
      }
      if (newKey !== undefined && newKey !== key) replacements.push({ start: start(property.name), end: property.name.end, text: keyText(property.name, newKey) });
      if (!ts.isPropertyAssignment(property)) continue;
      const initializer = property.initializer;
      if (isStringValue(initializer)) {
        const newValue = value(key, initializer.text);
        if (newValue !== undefined) replacements.push({ start: start(initializer), end: initializer.end, text: quote(initializer, newValue) });
      } else if (renamedValues(key).length && !ts.isObjectLiteralExpression(initializer)) {
        manual(initializer, `the value of ${key} is not a string literal; where it is produced, rename ${renamedValues(key).join(', ')}`);
      } else if (ts.isObjectLiteralExpression(initializer)) {
        const newText = nested(key, initializer);
        if (newText !== undefined) replacements.push({ start: start(initializer), end: initializer.end, text: newText });
      }
    }
    return { text: assemble(literal, replacements), changed: replacements.length > 0, remaining: properties.length - removed };
  }

  /** An object-literal argument of a library call, rewritten by the map's `options` and `values` entries for that path. */
  function argumentObject(literal, member, argument, path) {
    const { owner, name } = member;
    const renames = new Map(index.optionsFor(owner, name, argument, path).map(entry => [entry.from, entry.to]));
    return objectLiteral(literal, {
      rename: key => renames.get(key),
      value: (key, current) => index.valuesFor(owner, name, argument, [...path, key]).find(entry => entry.from === current)?.to,
      renamedValues: key => index.valuesFor(owner, name, argument, [...path, key]).map(entry => `'${entry.from}' to '${entry.to}'`),
      nested: (key, inner) => index.hasEntriesBelow(owner, name, argument, [...path, key]) ? argumentObject(inner, member, argument, [...path, key]).text : undefined,
      spreadReason: renames.size ? 'an options object is spread here; rename its keys where that object is built' : undefined,
    });
  }

  /** The transformed text of one call argument, with the map's entries for its position applied. */
  function argumentText(argumentNode, member, argument) {
    if (isStringValue(argumentNode)) {
      const entry = index.valuesFor(member.owner, member.name, argument, []).find(candidate => candidate.from === argumentNode.text);
      if (entry) return quote(argumentNode, entry.to);
    }
    if (ts.isObjectLiteralExpression(argumentNode) && index.hasEntriesBelow(member.owner, member.name, argument, [])) return argumentObject(argumentNode, member, argument, []).text;
    return text(argumentNode);
  }

  const lineIndent = position => /^[ \t]*/.exec(slice(source.lastIndexOf('\n', position - 1) + 1, position))[0];

  /** Positional arguments as one options bag, or undefined after reporting why it cannot be done. */
  function bagArguments(call, entry, member) {
    const { names, trailing } = entry.arguments;
    const argumentNodes = [...call.arguments];
    const extra = argumentNodes.slice(names.length);
    if (extra.length > 1 || (extra.length === 1 && !trailing)) { manual(call, `${member.name} has more arguments than the rename map describes; rewrite it to ${entry.to} by hand`); return undefined; }
    const parts = argumentNodes.slice(0, names.length).map((argumentNode, position) => {
      const value = argumentText(argumentNode, member, position);
      return value === names[position] ? value : `${names[position]}: ${value}`;
    });
    let after = '';
    if (extra.length === 1 && trailing.mode === 'keep') after = `, ${argumentText(extra[0], member, names.length)}`;
    if (extra.length === 1 && trailing.mode === 'merge') {
      if (!ts.isObjectLiteralExpression(extra[0])) { manual(call, `the last argument of ${member.name} is not an object literal; merge it into the ${entry.to} bag by hand`); return undefined; }
      const keys = trailing.keys ?? {};
      const merged = objectLiteral(extra[0], { rename: key => keys[key], spreadReason: 'an options object is spread here; rename its keys where that object is built' });
      const inner = merged.text.slice(1, -1).trim().replace(/,$/, '');
      if (inner) parts.push(inner);
    }
    if (parts.length === 0) return after.replace(/^, /, '');
    const multiline = parts.some(part => part.includes('\n')) || slice(call.arguments.pos, call.arguments.end).includes('\n');
    if (!multiline) return `{ ${parts.join(', ')} }${after}`;
    const indent = lineIndent(start(call.expression.name));
    return `{\n${parts.map(part => `${indent}  ${part},`).join('\n')}\n${indent}}${after}`;
  }

  function reportAnyReceiver(callee) {
    const name = callee.name.text;
    if (BUILTIN_MEMBERS.has(name) || !index.methodNames.has(name)) return;
    const receiver = checker.getTypeAtLocation(callee.expression);
    if (receiver.flags & ts.TypeFlags.Any) manual(callee, `the receiver of ${name} has type any, so this call cannot be checked; migrate it by hand if it is a DI Bag call`);
  }

  function transformApi(member) {
    return { ts, checker, sourceFile, member, text, slice, start, assemble, objectLiteral, quote, manual, nameOf: index.nameOf };
  }

  const partialReason = name => `${name} resolves to both DI Bag and non-library declarations; migrate this use by hand`;
  const conflictReason = name => `${name} resolves to declarations with incompatible rename-map entries; migrate this use by hand`;
  const withoutOwner = entry => {
    const { owner: _owner, ...rest } = entry;
    return rest;
  };

  /** The map behavior relevant to this call for one possible library owner. */
  function callPlan(member, name, count) {
    const entry = index.methodFor(member.owner, name, count);
    const touched = Array.from({ length: count }, (_, position) => position)
      .filter(position => index.hasEntriesBelow(member.owner, name, position, []));
    if (!entry && touched.length === 0) return undefined;
    const key = `${member.owner}.${name}`;
    const method = entry === undefined ? undefined : withoutOwner(entry);
    if (method) delete method.arity;
    const options = (index.options.get(key) ?? []).filter(candidate => candidate.argument < count).map(withoutOwner);
    const values = (index.argumentValues.get(key) ?? []).filter(candidate => candidate.argument < count).map(withoutOwner);
    return { member, entry, touched, signature: JSON.stringify({ method, options, values }) };
  }

  function rewriteCall(call) {
    const callee = call.expression;
    if (!ts.isPropertyAccessExpression(callee) || !index.callNames.has(callee.name.text)) return undefined;
    const name = callee.name.text;
    const coverage = library.memberCoverage(library.symbolAt(callee.name));
    const { members } = coverage;
    if (members.length === 0) { reportAnyReceiver(callee); return undefined; }
    const plans = members.map(member => callPlan(member, name, call.arguments.length));
    const relevant = plans.filter(Boolean);
    if (relevant.length === 0) return undefined;
    if (!coverage.complete) { manual(call, partialReason(name)); skip.add(callee); return undefined; }
    if (relevant.length !== members.length || new Set(relevant.map(plan => plan.signature)).size !== 1) {
      manual(call, conflictReason(name));
      skip.add(callee);
      return undefined;
    }
    const { member, entry, touched } = relevant[0];
    if ((entry?.arguments || entry?.transform) && call.arguments.some(ts.isSpreadElement)) {
      manual(call, `${name} is called with a spread argument; rewrite it to ${entry.to} by hand`);
      skip.add(callee);
      return undefined;
    }
    if (entry?.transform) {
      const result = transforms[entry.transform](call, transformApi(member));
      if (result === undefined) skip.add(callee);
      return result;
    }
    const replacements = [];
    if (entry && entry.to !== name) replacements.push({ start: start(callee.name), end: callee.name.end, text: entry.to });
    if (entry?.arguments?.kind === 'bag') {
      const bag = bagArguments(call, entry, member);
      if (bag === undefined) { skip.add(callee); return undefined; }
      // Up to the closing parenthesis, so a bag written over several lines does not leave `}` and `)` on separate lines.
      const closing = source[call.end - 1] === ')' ? call.end - 1 : call.arguments.end;
      if (call.arguments.pos !== closing || bag !== '') replacements.push({ start: call.arguments.pos, end: closing, text: bag });
    } else if (entry?.arguments?.kind === 'array') {
      if (call.arguments.length !== 1) { manual(call, `${name} is expected to take one argument; rewrite it to ${entry.to} by hand`); skip.add(callee); return undefined; }
      replacements.push({ start: start(call.arguments[0]), end: call.arguments[0].end, text: `[${argumentText(call.arguments[0], member, 0)}]` });
    } else {
      for (const position of touched) {
        const argumentNode = call.arguments[position];
        if (isStringValue(argumentNode) || ts.isObjectLiteralExpression(argumentNode)) replacements.push({ start: start(argumentNode), end: argumentNode.end, text: argumentText(argumentNode, member, position) });
        else manual(argumentNode, `argument ${position + 1} of ${name} is not a literal; where it is built, apply: ${index.describeArgumentEntries(member.owner, name, position)}`);
      }
    }
    return replacements.length ? assemble(call, replacements) : undefined;
  }

  /** The single rename target of a member, `null` when it must stay, after reporting what cannot be decided. */
  function memberRename(node, coverage, name, { called }) {
    const { members } = coverage;
    const propertyEntries = members.map(member => index.properties.get(`${member.owner}.${name}`));
    if (propertyEntries.some(Boolean)) {
      if (!coverage.complete) { manual(node, partialReason(name)); return null; }
      if (propertyEntries.some(entry => !entry)) { manual(node, `${name} resolves to several declarations and the rename map covers only some of them`); return null; }
      const manualEntry = propertyEntries.find(entry => entry.manual !== undefined);
      if (manualEntry) { manual(node, manualEntry.manual); return null; }
      const targets = new Set(propertyEntries.map(entry => entry.to));
      if (targets.size !== 1) { manual(node, `${name} resolves to declarations with different new names`); return null; }
      return [...targets][0];
    }
    if (called) return null;
    const entries = members.map(member => index.methodFor(member.owner, name, undefined));
    if (!entries.some(Boolean)) return null;
    if (!coverage.complete) { manual(node, partialReason(name)); return null; }
    if (entries.some(entry => !entry)) { manual(node, `${name} resolves to several declarations and the rename map covers only some of them`); return null; }
    const signatures = new Set(entries.map(entry => {
      const mapped = withoutOwner(entry);
      delete mapped.arity;
      return JSON.stringify(mapped);
    }));
    if (signatures.size !== 1) { manual(node, conflictReason(name)); return null; }
    const entry = entries[0];
    if (entry.transform || entry.arguments) { manual(node, `${name} is referenced without being called; rewrite this reference to ${entry.to} by hand`); return null; }
    return entry.to;
  }

  function rewritePropertyAccess(node) {
    const name = node.name.text;
    if (skip.has(node) || !index.memberNames.has(name)) return undefined;
    const coverage = library.memberCoverage(library.symbolAt(node.name));
    if (coverage.members.length === 0) return undefined;
    const called = ts.isCallExpression(node.parent) && node.parent.expression === node;
    const target = memberRename(node, coverage, name, { called });
    return target === null || target === name ? undefined : assemble(node, [{ start: start(node.name), end: node.name.end, text: target }]);
  }

  function rewriteBindingElement(element) {
    if (!ts.isObjectBindingPattern(element.parent)) return undefined;
    const keyNode = element.propertyName ?? element.name;
    if (!ts.isIdentifier(keyNode) || !index.memberNames.has(keyNode.text)) return undefined;
    const coverage = library.memberCoverage(checker.getTypeAtLocation(element.parent).getProperty(keyNode.text));
    const { members } = coverage;
    if (members.length === 0) return undefined;
    const entry = members.map(member => index.methodFor(member.owner, keyNode.text, undefined)).find(Boolean);
    const reshaped = entry?.transform !== undefined || entry?.arguments !== undefined || members.some(member => index.hasArgumentEntries(member.owner, keyNode.text));
    if (reshaped) manual(element, `${keyNode.text} is destructured; calls through the local name are not rewritten, migrate them by hand`);
    const target = memberRename(element, coverage, keyNode.text, { called: false });
    if (target === null || target === keyNode.text) return undefined;
    const replacement = element.propertyName
      ? { start: start(element.propertyName), end: element.propertyName.end, text: target }
      : { start: start(element.name), end: element.name.end, text: `${target}: ${keyNode.text}` };
    return assemble(element, [replacement]);
  }

  function propertyValueTarget(node, coverage, property, current) {
    const candidates = coverage.members.map(member => index.propertyValues.get(`${member.owner}.${property}=${current}`));
    if (!candidates.some(candidate => candidate !== undefined)) return undefined;
    if (!coverage.complete) { manual(node, partialReason(property)); return undefined; }
    if (candidates.some(candidate => candidate === undefined)) {
      manual(node, `${property} resolves to several declarations and the rename map covers only some of them`);
      return undefined;
    }
    const targets = new Set(candidates);
    if (targets.size !== 1) { manual(node, conflictReason(property)); return undefined; }
    return candidates[0];
  }

  function rewriteObjectLiteral(literal) {
    if (!literal.properties.some(property => index.propertyNames.has(literalKey(property) ?? ''))) return undefined;
    const contextual = checker.getContextualType(literal);
    if (!contextual) return undefined;
    const coverageFor = key => library.memberCoverage(checker.getPropertyOfType(contextual, key));
    const result = objectLiteral(literal, {
      rename: (key, property) => {
        if (!index.memberNames.has(key)) return undefined;
        const coverage = coverageFor(key);
        if (coverage.members.length === 0) return undefined;
        const target = memberRename(property, coverage, key, { called: true });
        return target === null ? undefined : target;
      },
      value: (key, current) => index.valuePropertyNames.has(key)
        ? propertyValueTarget(literal, coverageFor(key), key, current)
        : undefined,
    });
    return result.changed ? result.text : undefined;
  }

  function rewriteIdentifier(node) {
    const target = index.types.get(node.text);
    if (target === undefined) return undefined;
    const parent = node.parent;
    if (ts.isPropertyAccessExpression(parent) && parent.name === node) return undefined;
    const isKey = (ts.isPropertyAssignment(parent) || ts.isPropertySignature(parent) || ts.isPropertyDeclaration(parent) || ts.isMethodDeclaration(parent)
      || ts.isMethodSignature(parent) || ts.isBindingElement(parent) || ts.isEnumMember(parent)) && parent.name === node;
    if (isKey) return undefined;
    if ((ts.isImportSpecifier(parent) || ts.isExportSpecifier(parent)) && parent.propertyName !== undefined && parent.propertyName !== node) return undefined;
    if (library.exportNameOf(library.symbolAt(node)) !== node.text) return undefined;
    if (ts.isShorthandPropertyAssignment(parent)) return `${node.text}: ${target}`;
    if (ts.isExportSpecifier(parent) && parent.propertyName === undefined) {
      manual(parent, `${node.text} is re-exported; the re-export keeps its old public name, rename it when your own consumers can follow`);
      return `${target} as ${node.text}`;
    }
    return target;
  }

  const isModuleSpecifier = node => {
    const parent = node.parent;
    if ((ts.isImportDeclaration(parent) || ts.isExportDeclaration(parent)) && parent.moduleSpecifier === node) return true;
    if (ts.isLiteralTypeNode(parent) && ts.isImportTypeNode(parent.parent)) return true;
    if (ts.isExternalModuleReference(parent)) return true;
    return ts.isCallExpression(parent) && parent.arguments[0] === node
      && (parent.expression.kind === ts.SyntaxKind.ImportKeyword || (ts.isIdentifier(parent.expression) && parent.expression.text === 'require'));
  };

  /** The expression a string is compared with: the other side of `===`, or the subject of its `switch`. */
  function comparedWith(node) {
    const parent = node.parent;
    const equality = [ts.SyntaxKind.EqualsEqualsEqualsToken, ts.SyntaxKind.ExclamationEqualsEqualsToken, ts.SyntaxKind.EqualsEqualsToken, ts.SyntaxKind.ExclamationEqualsToken];
    if (ts.isBinaryExpression(parent) && equality.includes(parent.operatorToken.kind)) return parent.left === node ? parent.right : parent.left;
    if (ts.isCaseClause(parent) && parent.expression === node) return parent.parent.parent.expression;
    return undefined;
  }

  function rewriteString(node) {
    if (isModuleSpecifier(node)) {
      for (const entry of index.imports) {
        if (entry.from !== undefined && node.text === entry.from) return quote(node, entry.to);
        if (entry.fromSuffix !== undefined && node.text.startsWith('.')) {
          if (node.text.endsWith(entry.fromSuffix)) return quote(node, node.text.slice(0, -entry.fromSuffix.length) + entry.toSuffix);
          if (/\.[cm]?[jt]sx?$/.test(node.text) && node.text.replace(/\.[cm]?[jt]sx?$/, '').endsWith(entry.fromSuffix)) manual(node, `this import names the file with an extension; point it at ${entry.toSuffix} by hand`);
        }
      }
      return undefined;
    }
    const code = index.codes.get(node.text);
    if (code?.to !== undefined) return quote(node, code.to);
    if (index.propertyValueTexts.has(node.text)) {
      const other = comparedWith(node);
      if (other && ts.isPropertyAccessExpression(other) && index.valuePropertyNames.has(other.name.text)) {
        const property = other.name.text;
        const target = propertyValueTarget(node, library.memberCoverage(library.symbolAt(other.name)), property, node.text);
        if (target !== undefined) return quote(node, target);
      }
    }
    return undefined;
  }

  function rewriteNode(node) {
    if (ts.isCallExpression(node)) return rewriteCall(node);
    if (ts.isPropertyAccessExpression(node)) return rewritePropertyAccess(node);
    if (ts.isObjectLiteralExpression(node)) return rewriteObjectLiteral(node);
    if (ts.isBindingElement(node)) return rewriteBindingElement(node);
    if (ts.isIdentifier(node)) return rewriteIdentifier(node);
    if (isStringValue(node)) return rewriteString(node);
    return undefined;
  }

  let result = assemble(sourceFile, []);
  // `assemble` starts at the first token; keep the file's leading comments.
  result = slice(0, start(sourceFile)) + result;
  // Codes that survive sit in places no literal rewrite reaches: a split code, a regular expression, a template, a comment.
  const lines = result.split('\n');
  for (const [from, entry] of index.codes) {
    const pattern = new RegExp(`\\b${from}\\b`);
    lines.forEach((line, position) => {
      if (pattern.test(line)) manualItems.push({ file: fileLabel, line: position + 1, column: line.search(pattern) + 1, reason: entry.manual ?? `${from} appears outside a plain string; replace it with ${entry.to} by hand`, text: line.trim().slice(0, 120) });
    });
  }
  return { text: result, rewrites };
}
