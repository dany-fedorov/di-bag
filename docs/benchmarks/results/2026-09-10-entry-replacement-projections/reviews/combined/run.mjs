import fs from 'node:fs';import path from 'node:path';
import ts from '/tmp/di-bag-replacement-spike/node_modules/@typescript/old/lib/typescript.js';
import {compileNative,resolveNative} from '/tmp/di-bag-replacement-spike/scripts/native-compiler.ts';
const root='/tmp/di-bag-final-projection-review';const repo='/tmp/di-bag-replacement-spike';
const kind=process.argv[2],stage=process.argv[3]??'semantic';
if(ts.version!=='6.0.3')throw Error(ts.version);const native=kind==='native'?await resolveNative(repo):undefined;
const positive=['replacement-context','replacement-supported','replacement-reflection','replacement-reflection-consumer'];
const negative=['replacement-context','replacement-reflection','replacement-views','replacement-wrong-shape','inline-replacement-wrong-shape','union-replace','module-narrowing','module-rename'];
for(const variant of ['baseline','candidate']){
 const dir=`${root}/${variant}`;const emit=stage==='declarations';
 const files=stage==='inference'?[`${dir}/review/inference.ts`]:stage==='open'?[`${dir}/review/entries-open.ts`,`${dir}/review/generic-entries.ts`]:stage==='consumer'?[`${dir}/consumer.ts`,`${dir}/entries-consumer.ts`]:stage==='focus'?[`${dir}/review/output.ts`,`${dir}/review/replacement.ts`,`${dir}/review/entries-positive.ts`,`${dir}/review/entry-construction.ts`,`${dir}/review/install-wrappers.ts`]:[...positive.map(x=>`${dir}/tests/types/${x}.ts`),`${dir}/review/output.ts`,`${dir}/review/replacement.ts`,`${dir}/review/inference.ts`,`${dir}/review/entries-positive.ts`,`${dir}/review/entry-construction.ts`,`${dir}/review/install-wrappers.ts`,`${dir}/review/generic-entries-positive.ts`,`${dir}/review/entry-inference.ts`,...stage==='semantic'?negative.map(x=>`${dir}/tests/types/negative/${x}.ts`):[]];
 if(stage==='consumer')for(const name of ['consumer','entries-consumer'])fs.writeFileSync(`${dir}/${name}.ts`,fs.readFileSync(`${root}/${name}.ts`,'utf8').replaceAll('dist-KIND',`dist-${kind}`));
 const output=`${dir}/dist-${kind}`;let result;
 if(native)result=await compileNative(native,dir,files,{skipLibCheck:false,...emit?{noEmit:false,declaration:true,emitDeclarationOnly:true,noEmitOnError:true,outDir:output,rootDir:dir}:{}});
 else{
 const options={strict:true,noEmit:!emit,skipLibCheck:false,noUncheckedIndexedAccess:true,exactOptionalPropertyTypes:true,target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.NodeNext,moduleResolution:ts.ModuleResolutionKind.NodeNext,types:[],...emit?{declaration:true,emitDeclarationOnly:true,noEmitOnError:true,outDir:output,rootDir:dir}:{}};
 const start=performance.now(),program=ts.createProgram(files,options),diagnostics=ts.getPreEmitDiagnostics(program),checker=program.getTypeChecker(),declarations=[];
 for(const file of files)for(const s of program.getSourceFile(file).statements){
 if(ts.isVariableStatement(s))for(const d of s.declarationList.declarations)declarations.push({file:file.replace(dir,'<ROOT>'),name:d.name.getText(),type:checker.typeToString(checker.getTypeAtLocation(d.name),d,ts.TypeFormatFlags.NoTruncation)});
 if(ts.isFunctionDeclaration(s)&&s.name)declarations.push({file:file.replace(dir,'<ROOT>'),name:s.name.getText(),type:checker.typeToString(checker.getTypeAtLocation(s.name),s,ts.TypeFormatFlags.NoTruncation)});
 }
 const emitted=emit?program.emit():undefined;if(emitted)diagnostics.push(...emitted.diagnostics);
 result={diagnostics:diagnostics.map(d=>({file:d.file?.fileName,line:d.file&&d.start!==undefined?d.file.getLineAndCharacterOfPosition(d.start).line+1:undefined,column:d.file&&d.start!==undefined?d.file.getLineAndCharacterOfPosition(d.start).character+1:undefined,code:d.code,message:ts.flattenDiagnosticMessageText(d.messageText,'\n')})),declarations,emitSkipped:emitted?.emitSkipped,instantiations:program.getInstantiationCount(),milliseconds:Math.round(performance.now()-start)};
 }
 result={variant,compiler:kind,version:native?.version??ts.version,stage,...result};fs.writeFileSync(`${root}/${kind}-${stage}-${variant}.json`,JSON.stringify(result,null,2));
 console.log(JSON.stringify({variant,compiler:kind,version:result.version,stage,checked:result.checked,emitSkipped:result.emitSkipped,diagnostics:result.diagnostics.length,instantiations:result.instantiations,milliseconds:result.milliseconds}));
}
