import fs from 'node:fs';
import path from 'node:path';
import ts from '/tmp/di-bag-replacement-spike/node_modules/typescript/lib/typescript.js';
import {describeDiagnostic} from '/tmp/di-bag-replacement-spike/tests/compiler.ts';
const variant=process.argv[2], modified=fs.readFileSync(new URL(variant+'.ts',import.meta.url),'utf8');
const bs=new URL(variant+'.builder.ts',import.meta.url),builder=fs.existsSync(bs)?fs.readFileSync(bs,'utf8'):undefined;
const options={strict:true,noEmit:true,skipLibCheck:true,noUncheckedIndexedAccess:true,exactOptionalPropertyTypes:true,target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.NodeNext,moduleResolution:ts.ModuleResolutionKind.NodeNext,types:[]};
const host=ts.createCompilerHost(options),get=host.getSourceFile.bind(host),typesPath=path.resolve('src/types.ts');
host.getSourceFile=(fileName,version,...rest)=>fileName===path.resolve('src/di-bag.ts') && builder!==undefined ? ts.createSourceFile(fileName,builder,version,true) : fileName===typesPath ? ts.createSourceFile(fileName,modified,version,true) : get(fileName,version,...rest);
const root=path.resolve('tests/types');
function files(dir){return fs.readdirSync(dir,{withFileTypes:true}).flatMap(e=>e.isDirectory()?files(path.join(dir,e.name)):e.name.endsWith('.ts')?[path.join(dir,e.name)]:[])}
const roots=files(root),program=ts.createProgram(roots,options,host);
const diagnostics=ts.getPreEmitDiagnostics(program).map(describeDiagnostic);
const checker=program.getTypeChecker(),declarations=[];
for(const file of program.getSourceFiles())if(file.fileName.startsWith(root)&&!file.fileName.includes('/negative/')) {
 function visit(node){if(ts.isVariableDeclaration(node)&&ts.isIdentifier(node.name))declarations.push({file:path.relative(root,file.fileName),name:node.name.text,type:checker.typeToString(checker.getTypeAtLocation(node.name),node,ts.TypeFormatFlags.NoTruncation)});ts.forEachChild(node,visit)} visit(file)
}
console.log(JSON.stringify({variant,files:roots.length,diagnostics,declarations}));
