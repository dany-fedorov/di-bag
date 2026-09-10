import fs from 'node:fs';
import path from 'node:path';
import ts from '/tmp/di-bag-replacement-spike/node_modules/typescript/lib/typescript.js';
const repo = '/tmp/di-bag-replacement-spike';
const variant = process.argv[2];
const mode = process.argv[3] ?? 'check';
const source = fs.readFileSync(`/tmp/di-bag-completion-projection-probe/${variant}.ts`, 'utf8');
const generatedPath = `${repo}/tests/completion-review-probes.ts`;
const probe = fs.readFileSync(new URL(mode === 'emit' ? 'reflection.ts' : 'probes.ts', import.meta.url), 'utf8');
const options = {strict:true,noEmit:true,skipLibCheck:true,noUncheckedIndexedAccess:true,exactOptionalPropertyTypes:true,target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.NodeNext,moduleResolution:ts.ModuleResolutionKind.NodeNext,types:[]};
if (mode === 'emit') Object.assign(options, {noEmit:false,declaration:true,emitDeclarationOnly:true,outDir:`/tmp/di-bag-completion-projection-review/emit-${variant}`,rootDir:repo});
const host = ts.createCompilerHost(options), get = host.getSourceFile.bind(host);
host.getSourceFile = (fileName, version, ...rest) => fileName === `${repo}/src/types.ts` ? ts.createSourceFile(fileName, source, version, true) : fileName === generatedPath ? ts.createSourceFile(fileName, probe, version, true) : get(fileName, version, ...rest);
const program = ts.createProgram([generatedPath], options, host);
const emitted = mode === 'emit' ? program.emit() : undefined;
const diagnostics = [...ts.getPreEmitDiagnostics(program), ...(emitted?.diagnostics ?? [])].map(d => ({file:d.file?.fileName, line:d.file && d.start !== undefined ? d.file.getLineAndCharacterOfPosition(d.start).line + 1 : undefined, code:d.code, message:ts.flattenDiagnosticMessageText(d.messageText, '\n')}));
const checker = program.getTypeChecker(), declarations = [];
for (const statement of program.getSourceFile(generatedPath).statements) {
  if (!ts.isVariableStatement(statement)) continue;
  for (const declaration of statement.declarationList.declarations) {
    const type = checker.getTypeAtLocation(declaration.name);
    declarations.push({name:declaration.name.getText(), properties:checker.getPropertiesOfType(type).map(prop => {
      const type = checker.getTypeOfSymbolAtLocation(prop, declaration);
      return {name:prop.name, type:checker.typeToString(type, declaration, ts.TypeFormatFlags.NoTruncation), properties:checker.getPropertiesOfType(type).map(p => ({name:p.name, type:checker.typeToString(checker.getTypeOfSymbolAtLocation(p, declaration), declaration, ts.TypeFormatFlags.NoTruncation)}))};
    })});
  }
}
console.log(JSON.stringify({variant,mode,typescript:ts.version,diagnostics,declarations,instantiations:program.getInstantiationCount()}, null, 2));
