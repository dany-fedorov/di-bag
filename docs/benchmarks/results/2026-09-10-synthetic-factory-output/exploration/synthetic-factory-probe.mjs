import fs from 'node:fs';
import path from 'node:path';
import Module from 'node:module';
import {tokenScaleSource,tokenScalePath} from '/tmp/di-bag-replacement-spike/tests/compiler.ts';
const root='/tmp/di-bag-selected-resolution-review';
const repo='/tmp/di-bag-replacement-spike';
const isolation='/tmp/di-bag-module-resolution-isolation';
const variant=process.argv[2];
const compilerFile=`${repo}/node_modules/@typescript/old/lib/typescript.js`;
let text=fs.readFileSync(compilerFile,'utf8');
const anchor='totalInstantiationCount++;';
if(text.split(anchor).length!==2)throw Error('Compiler instrumentation anchor changed');
globalThis.__selectedResolutionWork=0;
text=text.replace(anchor,`if(currentNode?.expression?.name?.escapedText==='resolve' && currentNode.getSourceFile().fileName.includes('generated-token-scale')) globalThis.__selectedResolutionWork++;\n${anchor}`);
const loaded=new Module(compilerFile);loaded.filename=compilerFile;loaded.paths=Module._nodeModulePaths(path.dirname(compilerFile));loaded._compile(text,compilerFile);const ts=loaded.exports;
const replacements=new Map([
 [`${repo}/src/types.ts`,fs.readFileSync(`${isolation}/baseline.ts`,'utf8')],
 [`${repo}/src/di-bag.ts`,fs.readFileSync(`${isolation}/baseline.builder.ts`,'utf8')],
 [`${repo}/src/module-types.ts`,fs.readFileSync(`${root}/${variant}.synthetic.module-types.ts`,'utf8')],
 [`${repo}/src/provider.ts`,fs.readFileSync(`${root}/${variant}.synthetic.provider.ts`,'utf8')],
 [tokenScalePath,tokenScaleSource(200,'modules','valid')]
]);
const options={strict:true,noEmit:true,skipLibCheck:true,noUncheckedIndexedAccess:true,exactOptionalPropertyTypes:true,target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.NodeNext,moduleResolution:ts.ModuleResolutionKind.NodeNext,types:[]};
const host=ts.createCompilerHost(options),get=host.getSourceFile.bind(host);
host.getSourceFile=(name,version,...rest)=>replacements.has(name)?ts.createSourceFile(name,replacements.get(name),version,true):get(name,version,...rest);
const start=performance.now(),program=ts.createProgram([tokenScalePath],options,host);
const diagnostics=ts.getPreEmitDiagnostics(program).map(d=>({file:d.file?.fileName,line:d.file&&d.start!==undefined?d.file.getLineAndCharacterOfPosition(d.start).line+1:undefined,code:d.code,message:ts.flattenDiagnosticMessageText(d.messageText,'\n')}));
const result={variant,typescript:ts.version,count:200,form:'modules',diagnostics,instantiations:program.getInstantiationCount(),finalResolutionWork:globalThis.__selectedResolutionWork,milliseconds:Math.round(performance.now()-start)};
fs.writeFileSync(`${root}/${variant}.synthetic-result.json`,JSON.stringify(result,null,2));
console.log(JSON.stringify(result));
