import { supervise, trace } from './native-process.instrumented.ts';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
const node = execFileSync('node', ['-p', 'process.execPath'], {encoding:'utf8'}).trim();
const limits = { timeoutMilliseconds:3000,maxRssMiB:256,maxOutputBytes:4096,sampleMilliseconds:20 };
const delay = new Int32Array(new SharedArrayBuffer(4));
for (let run=0;run<200;run++) {
  trace.length=0; let zombiePid=0;
  const result=await supervise(node,['-e',"setTimeout(() => { console.log('out'); console.error('err'); }, 50)"],'/tmp',limits,async pid=>{
    const deadline=Date.now()+2000;
    while(Date.now()<deadline){
      const status=readFileSync(`/proc/${pid}/status`,'utf8');
      if(/^State:\s+Z/m.test(status)){
        process.kill(pid,0);zombiePid=pid;trace.push({event:'injected-esrch',pid,status});
        throw Object.assign(new Error('status read ESRCH during zombie exit'),{code:'ESRCH'});
      }
      Atomics.wait(delay,0,0,1);
    }
    throw new Error('Child did not reach zombie state before exit notification');
  });
  console.log(JSON.stringify({run,zombiePid,result,trace}));
}
