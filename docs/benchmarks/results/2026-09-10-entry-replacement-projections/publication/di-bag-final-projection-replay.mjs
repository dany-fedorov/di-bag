import fs from 'node:fs';import path from 'node:path';import {createHash} from 'node:crypto';
import {scaleSource,scaleBoundaryLine,tokenScaleSource,tokenScaleBoundaryLine} from '/tmp/di-bag-replacement-spike/tests/compiler.ts';
import {acceptDiagnostics,evaluateWorker} from '/tmp/di-bag-replacement-spike/scripts/benchmark-result.ts';
import {parseNativeDiagnostics} from '/tmp/di-bag-replacement-spike/scripts/native-compiler.ts';
const dir='/tmp/di-bag-final-projection-evidence/measurements';const rows=fs.readFileSync(`${dir}/rows.jsonl`,'utf8').trim().split('\n').map(JSON.parse);const manifest=JSON.parse(fs.readFileSync(`${dir}/manifest.json`,'utf8'));const output=[];
const same=(a,b)=>JSON.stringify(a)===JSON.stringify(b);const assert=(ok,msg)=>{if(!ok)throw Error(msg);};
for(const row of rows){
 const {count,form,scenario,lane,stage}=row,e=row.evidence,item={count,form,scenario};const token=form==='bindings'||form==='modules';
 const source=token?tokenScaleSource(count,form,scenario):scaleSource(count,form,scenario);const boundary=token?tokenScaleBoundaryLine(source):scaleBoundaryLine(source,count,form,scenario);
 const hash=createHash('sha256').update(source).digest('hex');assert(hash===e.generatedSha256Before&&hash===e.generatedSha256After&&hash===e.generatedSha256,`${lane}/${count}/${form}/${scenario}: generated hash`);
 assert(boundary===e.expectedBoundaryLine,`${lane}/${count}/${form}/${scenario}: original boundary`);
 let accepted;
 if(lane==='classic'){
  const file=path.join(manifest.roots[stage],'tests',token?'generated-token-scale.ts':'generated-type-scale.ts');const replay=evaluateWorker(item,e,file);accepted=replay.accepted;
  if(accepted){assert(same(replay.diagnostics,e.diagnostics),'classic diagnostic replay');assert(replay.boundaryLine===boundary,'classic compiled boundary');assert(replay.instantiations===e.instantiations,'classic work count');}
 }else{
  const file=e.diagnostics[0]?.file;const cwd=file?path.dirname(path.dirname(file)):'/tmp';const parsed=parseNativeDiagnostics(e.stdout,cwd);
  assert(same(parsed.diagnostics,e.diagnostics),'native diagnostic parse');assert(same(parsed.metrics,e.nativeMetrics),'native metrics parse');assert(parsed.unparsed.length===0,'native unparsed output');
  const checked=e.signal===null&&!e.terminationReason&&!e.error&&e.stderr===''&&(parsed.metrics.Files??0)>0&&(parsed.diagnostics.length===0?e.status===0:e.status===1)&&parsed.diagnostics.every(x=>x.file!==undefined);
  assert(checked===e.checked,'native checked replay');accepted=checked&&acceptDiagnostics(parsed.diagnostics,item,file??'/tmp/tests/generated.ts',boundary)&&e.boundaryLine===boundary;
 }
 assert(accepted===e.accepted,`${lane}/${count}/${form}/${scenario}: acceptance replay`);
 output.push({stage,lane,count,form,scenario,accepted,boundary:boundary??null,generatedSha256:hash});
}
fs.writeFileSync('/tmp/di-bag-final-projection-publication-replay.json',JSON.stringify(output,null,2)+'\n');console.log(JSON.stringify({regeneratedCases:output.length,acceptanceReplayed:output.length,accepted:output.filter(x=>x.accepted).length,rejected:output.filter(x=>!x.accepted).length,compilationInvoked:false}));
