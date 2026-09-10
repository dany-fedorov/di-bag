import fs from 'node:fs';
import path from 'node:path';
import ts from '/tmp/di-bag-replacement-spike/node_modules/@typescript/old/lib/typescript.js';
import {compileNative,resolveNative} from '/tmp/di-bag-replacement-spike/scripts/native-compiler.ts';
const root='/tmp/di-bag-synthetic-factory-review';
const repo='/tmp/di-bag-replacement-spike';
const kind=process.argv[2],stage=process.argv[3]??'semantic';
const variants=process.argv.slice(4).length?process.argv.slice(4):['baseline','candidate'];
if(ts.version!=='6.0.3')throw new Error(`Unexpected classic ${ts.version}`);
const native=kind==='native'?await resolveNative(repo):undefined;
for(const variant of variants){
 const dir=`${root}/${variant}`;
 const input=stage==='consumer'?'consumer':'tests';
 const files=fs.readdirSync(`${dir}/${input}`).filter(f=>f.endsWith('.ts') && (stage!=='declarations'||!['context.ts','reflected-keys.ts'].includes(f))).map(f=>`${dir}/${input}/${f}`);
 const emit=stage==='declarations';
 let result;
 if(native){
  result=await compileNative(native,dir,files,{skipLibCheck:false,...emit?{noEmit:false,declaration:true,emitDeclarationOnly:true,noEmitOnError:true,outDir:`${dir}/dist`,rootDir:dir}:{}});
 }else{
  const options={strict:true,noEmit:!emit,skipLibCheck:false,noUncheckedIndexedAccess:true,exactOptionalPropertyTypes:true,target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.NodeNext,moduleResolution:ts.ModuleResolutionKind.NodeNext,types:[],...emit?{declaration:true,emitDeclarationOnly:true,noEmitOnError:true,outDir:`${dir}/dist`,rootDir:dir}:{}};
  const start=performance.now(),program=ts.createProgram(files,options);
  const diagnosticObjects=ts.getPreEmitDiagnostics(program);
  const checker=program.getTypeChecker(), declarations=[];
  for(const file of files)for(const s of program.getSourceFile(file).statements){
   if(ts.isVariableStatement(s))for(const d of s.declarationList.declarations)declarations.push({file:path.basename(file),name:d.name.getText(),type:checker.typeToString(checker.getTypeAtLocation(d.name),d,ts.TypeFormatFlags.NoTruncation)});
   if(ts.isFunctionDeclaration(s)&&s.name)declarations.push({file:path.basename(file),name:s.name.getText(),type:checker.typeToString(checker.getTypeAtLocation(s.name),s,ts.TypeFormatFlags.NoTruncation)});
  }
  const emitted=emit?program.emit():undefined;
  if(emitted)diagnosticObjects.push(...emitted.diagnostics);
  result={diagnostics:diagnosticObjects.map(d=>({file:d.file?.fileName,line:d.file&&d.start!==undefined?d.file.getLineAndCharacterOfPosition(d.start).line+1:undefined,code:d.code,message:ts.flattenDiagnosticMessageText(d.messageText,'\n')})),declarations,emitSkipped:emitted?.emitSkipped,instantiations:program.getInstantiationCount(),milliseconds:Math.round(performance.now()-start)};
 }
 result={variant,compiler:kind,version:native?.version??ts.version,stage,...result};
 fs.writeFileSync(`${root}/${kind}-${stage}-${variant}.json`,JSON.stringify(result,null,2));
 console.log(JSON.stringify({variant,compiler:kind,version:result.version,stage,checked:result.checked,emitSkipped:result.emitSkipped,diagnostics:result.diagnostics}));
}
