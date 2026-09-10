import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import ts from 'typescript';

const entryPoints = ['index', 'node'];

function target(reflection) {
  return reflection.tryGetTargetReflection?.() ?? reflection;
}

function signatures(reflection) {
  const resolved = target(reflection);
  if (resolved.signatures) return resolved.signatures.length;
  if (resolved.type?.declaration) return signatures(resolved.type.declaration);
  if (resolved.type?.reflection) return signatures(resolved.type.reflection);
  if (resolved.type?.queryType?.reflection) return signatures(resolved.type.queryType.reflection);
  return 0;
}

/** Compare generated public declarations with the compiler's real export view. */
export function verifyApiCoverage(project, root, output) {
  const config = ts.getParsedCommandLineOfConfigFile(join(root, 'tsconfig.build.json'), {}, {
    ...ts.sys,
    onUnRecoverableConfigFileDiagnostic: diagnostic => { throw new Error(ts.flattenDiagnosticMessageText(diagnostic.messageText, '\n')); },
  });
  const program = ts.createProgram(config.fileNames, config.options);
  const checker = program.getTypeChecker();
  const report = { entryPoints: {}, callableOverloads: {} };
  for (const name of entryPoints) {
    const source = program.getSourceFile(join(root, `src/${name}.ts`));
    const symbols = checker.getExportsOfModule(checker.getSymbolAtLocation(source));
    const module = project.children.find(child => child.name === name);
    assert(module, `Missing reference entry point ${name}`);
    const actual = module.children.map(child => child.name).sort();
    const expected = symbols.map(symbol => symbol.name).sort();
    assert.deepEqual(actual, expected, `${name}: generated exports differ from TypeScript exports`);
    const markdown = readFileSync(join(output, name, 'index.md'), 'utf8');
    for (const symbol of symbols) {
      assert(markdown.includes(`[${symbol.name}](`), `${name}: missing Markdown link for ${symbol.name}`);
      const resolved = symbol.flags & ts.SymbolFlags.Alias ? checker.getAliasedSymbol(symbol) : symbol;
      const declaration = resolved.declarations?.[0];
      const reflection = target(module.children.find(child => child.name === symbol.name));
      if (declaration) {
        const exportedType = ts.isTypeAliasDeclaration(declaration)
          && (ts.isTypeQueryNode(declaration.type) || ts.isFunctionTypeNode(declaration.type))
          ? checker.getDeclaredTypeOfSymbol(resolved)
          : checker.getTypeOfSymbolAtLocation(resolved, declaration);
        const count = checker.getSignaturesOfType(exportedType, ts.SignatureKind.Call).length;
        if (count) {
          assert.equal(signatures(reflection), count, `${name}.${symbol.name}: overload count differs`);
          report.callableOverloads[`${name}.${symbol.name}`] = count;
        }
        // Type-only class exports are intentionally rendered as interfaces.
        const typeOnly = symbol.declarations?.every(item => ts.isExportSpecifier(item) && (item.isTypeOnly || item.parent.parent.isTypeOnly));
        if (ts.isClassDeclaration(declaration)) {
          const constructor = reflection.children?.find(child => child.name === 'constructor');
          if (typeOnly) assert(!constructor, `${name}.${symbol.name}: type-only export exposes a constructor`);
          else {
            const constructors = checker.getSignaturesOfType(exportedType, ts.SignatureKind.Construct).length;
            assert.equal(constructor?.signatures?.length ?? 0, constructors, `${name}.${symbol.name}: constructor overload count differs`);
            report.callableOverloads[`${name}.${symbol.name}.constructor`] = constructors;
          }
        }
      }
      if (!declaration || !(ts.isInterfaceDeclaration(declaration) || ts.isClassDeclaration(declaration))) continue;
      const type = checker.getDeclaredTypeOfSymbol(resolved);
      for (const member of type.getProperties()) {
        const decl = member.declarations?.[0];
        if (!decl || !decl.getSourceFile().fileName.startsWith(join(root, 'src/'))) continue;
        const flags = ts.getCombinedModifierFlags(decl);
        if (flags & (ts.ModifierFlags.Private | ts.ModifierFlags.Protected)) continue;
        if (member.name.startsWith('__@') || member.name.startsWith('#')) continue;
        const documented = reflection.children?.find(child => child.name === member.name);
        assert(documented, `${name}.${symbol.name}: missing member ${member.name}`);
        const memberType = checker.getTypeOfSymbolAtLocation(member, decl);
        // A generic property displays its type parameter, not the constraint's
        // call signatures. Verify that reference without inventing overloads.
        if (memberType.flags & ts.TypeFlags.TypeParameter) {
          assert(documented.type?.refersToTypeParameter, `${name}.${symbol.name}.${member.name}: missing type parameter reference`);
          assert.equal(documented.type.name, memberType.symbol.name, `${name}.${symbol.name}.${member.name}: type parameter differs`);
          continue;
        }
        const count = checker.getSignaturesOfType(memberType, ts.SignatureKind.Call).length;
        assert.equal(signatures(documented), count, `${name}.${symbol.name}.${member.name}: overload count differs`);
        if (count) report.callableOverloads[`${name}.${symbol.name}.${member.name}`] = count;
      }
    }
    report.entryPoints[name] = expected;
  }
  return report;
}
