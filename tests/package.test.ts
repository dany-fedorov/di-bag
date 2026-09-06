import { beforeAll, expect, test } from 'bun:test';
import { resolve } from 'node:path';
import ts from 'typescript';

const root = resolve(__dirname, '..');

async function run(command: string[]) {
  const process = Bun.spawn(command, {
    cwd: root,
    stdout: 'pipe',
    stderr: 'pipe',
  });
  const [exitCode, stdout, stderr] = await Promise.all([
    process.exited,
    new Response(process.stdout).text(),
    new Response(process.stderr).text(),
  ]);
  expect({ exitCode, stderr }).toEqual({ exitCode: 0, stderr: '' });
  return stdout.trim();
}

beforeAll(async () => {
  await run([
    'node',
    'node_modules/typescript/bin/tsc',
    '-p',
    'tsconfig.build.json',
  ]);
});

for (const mode of ['commonjs', 'module'] as const) {
  test(`Node ${mode} consumers can resolve and dispose through the public package`, async () => {
    const load =
      mode === 'commonjs'
        ? "const { DiBag } = require('di-bag');"
        : "import { DiBag } from 'di-bag';";
    const stdout = await run([
      'node',
      `--input-type=${mode}`,
      '--eval',
      `${load}
      (async () => {
        let disposed;
        const bag = DiBag.begin().add({
          answer: DiBag.withDisposal(() => 42, value => { disposed = value; }),
        }).end();
        const answer = bag.resolve('answer');
        await bag.close();
        console.log(JSON.stringify({ answer, disposed }));
      })().catch(error => { console.error(error); process.exitCode = 1; });
    `,
    ]);
    expect(JSON.parse(stdout)).toEqual({ answer: 42, disposed: 42 });
  });

  test(`TypeScript ${mode} consumers can use the emitted declarations`, () => {
    const path = resolve(
      __dirname,
      mode === 'commonjs' ? 'consumer.cts' : 'consumer.mts',
    );
    const source = `import { DiBag } from 'di-bag';
      const bag = DiBag.begin().add({
        value: DiBag.withDisposal(async () => 42, value => { const n: number = value; void n; }),
      }).end();
      const value: Promise<number> = bag.resolve('value');
      void [value, bag.close()];`;
    const options: ts.CompilerOptions = {
      strict: true,
      noEmit: true,
      types: [],
      target: ts.ScriptTarget.ES2022,
      module: ts.ModuleKind.NodeNext,
      moduleResolution: ts.ModuleResolutionKind.NodeNext,
    };
    const host = ts.createCompilerHost(options);
    const getSourceFile = host.getSourceFile.bind(host);
    host.getSourceFile = (name, languageVersion, onError, fresh) =>
      name === path
        ? ts.createSourceFile(path, source, ts.ScriptTarget.ES2022, true)
        : getSourceFile(name, languageVersion, onError, fresh);
    const program = ts.createProgram([path], options, host);
    expect(
      ts
        .getPreEmitDiagnostics(program)
        .map((error) =>
          ts.flattenDiagnosticMessageText(error.messageText, '\n'),
        ),
    ).toEqual([]);
  });
}
