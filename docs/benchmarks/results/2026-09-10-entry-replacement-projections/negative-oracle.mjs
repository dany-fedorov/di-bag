import {readFileSync,writeFileSync} from 'node:fs';
import {scaleBoundaryLine} from '/tmp/di-bag-replacement-spike/tests/compiler.ts';
import {acceptDiagnostics} from '/tmp/di-bag-replacement-spike/scripts/benchmark-result.ts';
const root='/tmp/di-bag-named-checker-probe',results=[];
for(const form of ['chained','replacement']) for(const scenario of ['missing','wrong-shape']) {
 const e=JSON.parse(readFileSync(`${root}/final-native1000-${form}-${scenario}.stdout.log`,'utf8'));
 const file=`${root}/native-final-projection-1000-${form}-${scenario}/tests/generated-type-scale.ts`;
 const source=readFileSync(file,'utf8'),boundary=scaleBoundaryLine(source,1000,form,scenario);
 const accepted=e.checked && acceptDiagnostics(e.diagnostics,{count:1000,form,scenario},file,boundary);
 results.push({form,scenario,accepted,boundary,diagnostics:e.diagnostics.map(d=>({code:d.code,line:d.line})),milliseconds:e.milliseconds,rssMiB:e.peakObservedRssMiB});
 if(!accepted)throw Error('Original negative boundary failed: '+form+' '+scenario);
}
writeFileSync(root+'/final-native1000-negative-oracle.json',JSON.stringify(results,null,2)+'\n');console.log(JSON.stringify(results));
