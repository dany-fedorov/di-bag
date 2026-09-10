import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import ts from './instrumented-typescript.cjs';
import {scaleSource,scalePath} from '/tmp/di-bag-replacement-spike/tests/compiler.ts';
const form=process.argv[2]??'chained';
const source=scaleSource(1000,form,'valid');
const options={strict:true,noEmit:true,skipLibCheck:true,noUncheckedIndexedAccess:true,exactOptionalPropertyTypes:true,target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.NodeNext,moduleResolution:ts.ModuleResolutionKind.NodeNext,types:[]};
const host=ts.createCompilerHost(options),original=host.getSourceFile.bind(host);
host.getSourceFile=(name,version,...rest)=>name===scalePath?ts.createSourceFile(name,source,version,true):original(name,version,...rest);
// Preserve the authentic compiler's lib directory; this copy is only for diagnostics.
host.getDefaultLibLocation=()=>'/tmp/di-bag-performance-integration/node_modules/@typescript/old/lib';
host.getDefaultLibFileName=()=>path.join(host.getDefaultLibLocation(),'lib.es2022.full.d.ts');
Error.stackTraceLimit=15000;
const start=performance.now();
let result={form,count:1000,compiler:ts.version,diagnosticOnly:true,generatedSha256:crypto.createHash('sha256').update(source).digest('hex')};
try{
 const program=ts.createProgram([scalePath],options,host);
 const diagnostics=ts.getPreEmitDiagnostics(program);
 result.diagnostics=diagnostics.map(d=>({code:d.code,message:ts.flattenDiagnosticMessageText(d.messageText,'\n')}));
 result.instantiations=program.getInstantiationCount();
}catch(error){
 const node=globalThis.__diCallNode,signature=globalThis.__diMinSignature,type=globalThis.__diInstantiation,symbol=globalThis.__diInstantiatedSymbol;
 const describeType=t=>t?{id:t.id,flags:t.flags,name:t.symbol?.escapedName,alias:t.aliasSymbol?.escapedName,intrinsicName:t.intrinsicName,declaration:t.symbol?.declarations?.[0]?.getText().slice(0,350),unionMembers:t.types?.map(a=>({id:a.id,flags:a.flags,name:a.symbol?.escapedName,alias:a.aliasSymbol?.escapedName})),typeArguments:t.typeArguments?.map(a=>({id:a.id,flags:a.flags,name:a.symbol?.escapedName,alias:a.aliasSymbol?.escapedName}))}:null;
 const describeMapper=(mapper,depth=0)=>!mapper||depth>5?null:{kind:mapper.kind,source:describeType(mapper.source),target:describeType(mapper.target),sources:mapper.sources?.map(describeType),targets:mapper.kind===2?'deferred callbacks not invoked':mapper.targets?.map(describeType),mapper1:describeMapper(mapper.mapper1,depth+1),mapper2:describeMapper(mapper.mapper2,depth+1)};
 result.error=String(error);result.stack=error.stack;
 result.lastEnteredCall=node?{pos:node.pos,end:node.end,expressionKind:node.expression.kind,method:node.expression.name?.escapedText,firstArgumentKey:node.arguments?.[0]?.properties?.[0]?.name?.escapedText}:null;
 result.lastMinSignature=signature?{name:signature.declaration?.name?.escapedText,parameterNames:signature.parameters?.map(s=>s.escapedName),targetParameterNames:signature.target?.parameters?.map(s=>s.escapedName),mapperKind:signature.mapper?.kind,mapperSource:describeType(signature.mapper?.source),mapperTarget:describeType(signature.mapper?.target)}:null;
 result.lastInstantiatedSymbol=symbol?{name:symbol.escapedName,mapperKind:symbol.links?.mapper?.kind}:null;
 result.lastInstantiatedType=describeType(type);
 result.minSignatureMapper=describeMapper(signature?.mapper);
 result.instantiationMapper=describeMapper(globalThis.__diMapper);
}
result.milliseconds=performance.now()-start;
fs.writeFileSync(new URL('instrumented-'+form+'.json',import.meta.url),JSON.stringify(result,null,2)+'\n');
console.log(JSON.stringify({...result,stack:result.stack?.split('\n').slice(0,15)}));
