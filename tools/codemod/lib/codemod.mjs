// tools/codemod/lib/codemod.mjs
import { writeFileSync } from 'node:fs';
import { dirname, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { expandGlob } from './glob.mjs';
import { createLibrary } from './library.mjs';
import { indexRenameMap, loadRenameMap, validateRenameMap } from './rename-map.mjs';
import { rewriteSourceFile } from './rewrite.mjs';
import { transforms } from './transforms/index.mjs';

export { loadTypeScript } from './load-typescript.mjs';
export { validateRenameMap } from './rename-map.mjs';
export { transforms };

/** The map shipped with this package: the distance from di-bag 0.4.0 to the current API. */
export const defaultMapFile = resolve(dirname(fileURLToPath(import.meta.url)), '../rename-map.json');

function loadProgram(ts, { project, files, root, extraFiles }) {
  const extra = extraFiles.flatMap(pattern => expandGlob(pattern, root));
  if (project) {
    const config = ts.getParsedCommandLineOfConfigFile(resolve(root, project), {}, {
      ...ts.sys, onUnRecoverableConfigFileDiagnostic: diagnostic => { throw new Error(ts.flattenDiagnosticMessageText(diagnostic.messageText, '\n')); },
    });
    return ts.createProgram([...new Set([...config.fileNames, ...extra])], { ...config.options, noEmit: true });
  }
  return ts.createProgram([...new Set([...files.map(file => resolve(root, file)), ...extra])], {
    strict: true, noEmit: true, skipLibCheck: true, types: [],
    target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.NodeNext, moduleResolution: ts.ModuleResolutionKind.NodeNext,
  });
}

/**
 * Rewrite every source file of a program that is neither a declaration file, nor under
 * `node_modules`, nor part of the library itself.
 * @param {{ typescript: typeof import('typescript'), root: string, project?: string, files?: string[], extraFiles?: string[],
 *   libraryRoots?: string[], map?: object, mapFile?: string, write?: boolean, only?: string[], program?: import('typescript').Program }} options
 * @returns {{ files: { file: string, rewrites: number, text: string }[], manual: { file: string, line: number, column: number, reason: string, text: string }[], rewrites: number }}
 */
export function runCodemod({ typescript: ts, root, project, files = [], extraFiles = [], libraryRoots = [], map, mapFile = defaultMapFile, write = false, only, program }) {
  const renameMap = map ?? loadRenameMap(mapFile, Object.keys(transforms));
  const problems = validateRenameMap(renameMap, Object.keys(transforms));
  if (problems.length) throw new Error(`invalid rename map:\n${problems.join('\n')}`);
  const index = indexRenameMap(renameMap);
  const built = program ?? loadProgram(ts, { project, files, root, extraFiles });
  const checker = built.getTypeChecker();
  const library = createLibrary({ ts, checker, root, libraryRoots });
  const selected = only === undefined ? undefined : new Set(only.map(file => resolve(root, file)));
  const writableSourceFiles = new Set(built.getSourceFiles()
    .map(sourceFile => resolve(sourceFile.fileName))
    .filter(fileName => !fileName.includes('/node_modules/') && !library.isLibraryFile(fileName) && (selected === undefined || selected.has(fileName))));
  const changed = [];
  const manual = [];
  let rewrites = 0;
  for (const sourceFile of built.getSourceFiles()) {
    const fileName = resolve(sourceFile.fileName);
    if (sourceFile.isDeclarationFile || fileName.includes('/node_modules/') || library.isLibraryFile(fileName)) continue;
    if (selected && !selected.has(fileName)) continue;
    const fileLabel = relative(root, fileName).replaceAll('\\', '/');
    let result;
    try {
      result = rewriteSourceFile({
        ts, checker, program: built, sourceFile, library, index, transforms, writableSourceFiles,
        manualItems: manual,
        fileLabel,
      });
    } catch (error) {
      manual.push({ file: fileLabel, line: 1, column: 1, reason: `this file was left untouched: ${error.message}`, text: '' });
      continue;
    }
    if (result.text === sourceFile.text) continue;
    changed.push({ file: fileLabel, rewrites: result.rewrites, text: result.text });
    rewrites += result.rewrites;
    if (write) writeFileSync(fileName, result.text);
  }
  manual.sort((left, right) => left.file.localeCompare(right.file) || left.line - right.line || left.column - right.column);
  return { files: changed, manual, rewrites };
}
