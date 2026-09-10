import { cpSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { compileNative, resolveNative } from '/tmp/di-bag-replacement-spike/scripts/native-compiler.ts';
const repo = '/tmp/di-bag-replacement-spike';
const root = '/tmp/di-bag-completion-projection-review';
const compiler = await resolveNative(repo);
for (const variant of ['baseline', 'token-projection']) {
  const dir = `${root}/native-${variant}`;
  mkdirSync(`${dir}/tests`, {recursive:true});
  cpSync(`${repo}/src`, `${dir}/src`, {recursive:true});
  const source = readFileSync(`/tmp/di-bag-completion-projection-probe/${variant}.ts`, 'utf8');
  const probe = readFileSync(`${root}/probes.ts`, 'utf8');
  writeFileSync(`${dir}/src/types.ts`, source);
  writeFileSync(`${dir}/tests/probes.ts`, probe);
  const result = await compileNative(compiler, dir, [`${dir}/tests/probes.ts`], {skipLibCheck:true});
  const data = {variant, typescript:compiler.version, sourceSha256:createHash('sha256').update(source).digest('hex'), probeSha256:createHash('sha256').update(probe).digest('hex'), ...result};
  writeFileSync(`${root}/${variant}-native.json`, JSON.stringify(data, null, 2));
  console.log(JSON.stringify({variant,typescript:compiler.version,status:data.status,checked:data.checked,diagnostics:data.diagnostics}));
}
