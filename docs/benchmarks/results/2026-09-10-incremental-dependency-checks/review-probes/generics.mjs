import fs from 'node:fs';
import path from 'node:path';
import ts from '/tmp/di-bag-replacement-spike/node_modules/typescript/lib/typescript.js';
const variant=process.argv[2];
const probe=path.resolve('tests/dependency-shortcuts-generic-review.ts');
let source=`import type {Builder, Registration} from '../src';
import type {Entry, IncrementalChecked} from '../src/types';
import type {Registrations} from '../src/registration';
import type {TokenBase, Token} from '../src/tokens';
import type {Provider, ProviderBase} from '../src/provider';
import type {TokenGraph} from '../src/token-types';
declare const a:unique symbol,b:unique symbol;
type A=Token<typeof a,number>;
type BadA=Token<typeof a,string>;
type NeedA=Provider<()=>number,{},readonly [],TokenGraph<readonly [A]>>;
type Opaque=Provider<()=>number,{},readonly [],TokenGraph<readonly [TokenBase]>>;
type BindA=Provider<()=>number,{},readonly [],TokenGraph<readonly [],A>>;
declare const token:A;
declare const bound:BindA;
declare function checked<E extends Entry,N extends Registrations>(history:E, incoming:N & IncrementalChecked<E,N>): [E,N];
export function forwardAdd<E extends Entry,N extends Registrations>(builder:Builder<E>, registration:Parameters<typeof builder.add<N>>[0]) {return builder.add<N>(registration);}
export function forwardBind<E extends Entry,T extends TokenBase,V extends Registration>(builder:Builder<E>, token:Parameters<typeof builder.bind<T,V>>[0], registration:Parameters<typeof builder.bind<T,V>>[1]) {return builder.bind<T,V>(token,registration);}
export function forwardCheck<E extends Entry,N extends Registrations>(history:E, incoming:N & IncrementalChecked<E,N>) {return checked<E,N>(history,incoming);}
`;
const keys=['never','any','string','symbol','"consumer"','typeof a','"consumer" | typeof a','`svc:${string}`'];
keys.forEach((key,i)=>{
 source+=`export function addGenericRegistration_${i}<R extends Registration>(builder:Builder<{key:${key};registration:R}>) { return builder.add({x:()=>1}); }\n`;
 source+=`export function bindGenericRegistration_${i}<R extends Registration>(builder:Builder<{key:${key};registration:R}>) { return builder.bind(token,()=>1); }\n`;
 source+=`export function needsGenericRegistration_${i}<R extends NeedA>(builder:Builder<{key:${key};registration:R}>) { return builder.bind(token,()=>1); }\n`;
 source+=`export function addGenericNeeds_${i}<D extends object>(builder:Builder<{key:${key};registration:(deps:D)=>number}>) { return builder.add({x:()=>1}); }\n`;
 source+=`export function checkGenericRegistration_${i}<R extends Registration>(history:{key:${key};registration:R}) { return checked(history,{x:()=>1}); }\n`;
});
for(const [i,e] of ['Entry','never','any','{key:never;registration:Opaque}','{key:any;registration:NeedA}','{key:"consumer";registration:NeedA | Opaque}','{key:"consumer";registration:NeedA} | {key:"opaque";registration:Opaque}'].entries()){
 source+=`export function addGenericIncoming_${i}<N extends Registrations>(builder:Builder<${e}>, registration:Parameters<typeof builder.add<N>>[0]) { return builder.add<N>(registration); }\n`;
 source+=`export function bindGenericIncoming_${i}<T extends TokenBase,V extends Registration>(builder:Builder<${e}>, token:Parameters<typeof builder.bind<T,V>>[0], registration:Parameters<typeof builder.bind<T,V>>[1]) { return builder.bind<T,V>(token,registration); }\n`;
}
source+=`export function genericKey<K extends string|symbol>(history:{key:K;registration:NeedA}) {return checked(history,{[a]:bound});}
export function genericUnion<E extends Entry>(history:E|{key:'opaque';registration:Opaque}) {return checked(history,{[a]:bound});}
export function constrainedKey<K extends 'consumer'>(history:{key:K;registration:NeedA}) {return checked(history,{[a]:bound});}
export function constrainedSymbol<K extends typeof b>(history:{key:K;registration:NeedA}) {return checked(history,{[a]:bound});}
`;
const localSnapshot=`/tmp/di-bag-dependency-shortcuts-review/${variant}.ts`;
const snapshot=fs.existsSync(localSnapshot)?localSnapshot:`/tmp/di-bag-empty-dependency-probe/${variant}.ts`;
const virtual=new Map([[probe,source],[path.resolve('src/types.ts'),fs.readFileSync(snapshot,'utf8')]]);
const options={strict:true,noEmit:true,skipLibCheck:true,noUncheckedIndexedAccess:true,exactOptionalPropertyTypes:true,target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.NodeNext,moduleResolution:ts.ModuleResolutionKind.NodeNext,types:[]};
const host=ts.createCompilerHost(options),get=host.getSourceFile.bind(host);
host.getSourceFile=(file,version,...rest)=>virtual.has(file)?ts.createSourceFile(file,virtual.get(file),version,true):get(file,version,...rest);
const program=ts.createProgram([probe],options,host),checker=program.getTypeChecker();
const diagnostics=ts.getPreEmitDiagnostics(program).map(d=>({code:d.code,file:d.file?.fileName,start:d.start,message:ts.flattenDiagnosticMessageText(d.messageText,'\n')}));
const declarations=[];
for(const node of program.getSourceFile(probe).statements)if(ts.isFunctionDeclaration(node)&&node.name){const sig=checker.getSignatureFromDeclaration(node);declarations.push({name:node.name.text,returnType:checker.typeToString(checker.getReturnTypeOfSignature(sig),node,ts.TypeFormatFlags.NoTruncation)});}
console.log(JSON.stringify({variant,version:ts.version,diagnostics,declarations,source},null,2));
