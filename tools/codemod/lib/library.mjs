// tools/codemod/lib/library.mjs
import { resolve } from 'node:path';

const normalize = file => file.replaceAll('\\', '/');

/**
 * Decides which declarations belong to DI Bag and names their owner.
 * With `libraryRoots` the library is those directories (this repository runs with `src` and `dist`);
 * without any, the library is every `node_modules/di-bag/` directory.
 */
export function createLibrary({ ts, checker, root, libraryRoots = [] }) {
  const prefixes = libraryRoots.map(directory => `${normalize(resolve(root, directory))}/`);
  const isLibraryFile = fileName => {
    const file = normalize(fileName);
    return prefixes.length === 0 ? file.includes('/node_modules/di-bag/') : prefixes.some(prefix => file.startsWith(prefix));
  };

  /** The symbol a name refers to, with import aliases followed. */
  function symbolAt(node) {
    let symbol = checker.getSymbolAtLocation(node);
    if (symbol && symbol.flags & ts.SymbolFlags.Alias) symbol = checker.getAliasedSymbol(symbol);
    return symbol;
  }

  /**
   * The owner of a member declaration: the nearest enclosing named declaration.
   * A class, interface or type alias gives `Name`; a function gives `name()`;
   * a method gives `Owner.method()`. A type literal written inline in a signature
   * therefore belongs to that function or method.
   */
  function ownerOf(declaration) {
    for (let node = declaration.parent; node; node = node.parent) {
      if ((ts.isClassDeclaration(node) || ts.isInterfaceDeclaration(node) || ts.isTypeAliasDeclaration(node)) && node.name) return node.name.text;
      if (ts.isFunctionDeclaration(node) && node.name) return `${node.name.text}()`;
      if ((ts.isMethodDeclaration(node) || ts.isMethodSignature(node)) && ts.isIdentifier(node.name)) {
        const container = node.parent;
        if ((ts.isClassDeclaration(container) || ts.isInterfaceDeclaration(container)) && container.name) return `${container.name.text}.${node.name.text}()`;
      }
    }
    return undefined;
  }

  /** Library members plus whether every declaration of the symbol belongs to a named library owner. */
  function memberCoverage(symbol) {
    const members = new Map();
    const declarations = symbol?.declarations ?? [];
    let complete = declarations.length > 0;
    for (const declaration of declarations) {
      if (!isLibraryFile(declaration.getSourceFile().fileName)) { complete = false; continue; }
      const owner = ownerOf(declaration);
      if (owner === undefined) { complete = false; continue; }
      members.set(`${owner}.${symbol.name}`, { owner, name: symbol.name });
    }
    return { members: [...members.values()], complete };
  }

  /** Every distinct `{ owner, name }` a member symbol is declared as inside the library. */
  const membersOf = symbol => memberCoverage(symbol).members;

  /** The exported name when the symbol is a top-level declaration of the library, else undefined. */
  function exportNameOf(symbol) {
    for (const declaration of symbol?.declarations ?? []) {
      if (!isLibraryFile(declaration.getSourceFile().fileName)) continue;
      const holder = ts.isVariableDeclaration(declaration) ? declaration.parent?.parent : declaration;
      if (holder?.parent && ts.isSourceFile(holder.parent)) return symbol.name;
    }
    return undefined;
  }

  return { isLibraryFile, symbolAt, membersOf, memberCoverage, exportNameOf };
}
