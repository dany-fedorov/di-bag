import { compilerCaseExitCode, parseCompilerCase, runCompilerCase } from './compiler-case.ts';

async function main() {
  const { lane, item } = parseCompilerCase(process.argv.slice(2));
  const row = await runCompilerCase(process.cwd(), lane, item);
  console.log(JSON.stringify(row));
  process.exitCode = compilerCaseExitCode(row);
}

main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
