import subprocess, json, time, sys, pathlib, fcntl, hashlib
root=pathlib.Path(__file__).resolve().parents[4]
out=pathlib.Path(__file__).resolve().parent
label=sys.argv[1]; command=sys.argv[2:]
with open('/tmp/di-bag-compiler-heavy.lock','w') as lock:
 fcntl.flock(lock, fcntl.LOCK_EX)
 start=time.time()
 try:
  result=subprocess.run(command,cwd=root,stdout=subprocess.PIPE,stderr=subprocess.STDOUT,timeout=1800)
  code=result.returncode; output=result.stdout
 except subprocess.TimeoutExpired as error: code=124; output=(error.stdout or b'')+b'\nrecorder timeout\n'
 (out/(label+'.log')).write_bytes(output)
 record=dict(label=label,command=command,status=code,seconds=time.time()-start,source=subprocess.check_output(['git','rev-parse','HEAD'],cwd=root,text=True).strip(),diff_sha256=hashlib.sha256(subprocess.check_output(['git','diff'],cwd=root)).hexdigest())
 with (out/'commands.jsonl').open('a') as stream: stream.write(json.dumps(record)+'\n')
 print(json.dumps(record));print(output.decode(errors='replace')[-2500:])
 sys.exit(code)
