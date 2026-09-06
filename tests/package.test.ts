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
        ? "const packageExports = require('di-bag'); const { DiBag } = packageExports;"
        : "import * as packageExports from 'di-bag'; const { DiBag } = packageExports;";
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
        console.log(JSON.stringify({ answer, disposed, publiclyConstructible: Object.hasOwn(packageExports, 'Bag') }));
      })().catch(error => { console.error(error); process.exitCode = 1; });
    `,
    ]);
    expect(JSON.parse(stdout)).toEqual({ answer: 42, disposed: 42, publiclyConstructible: false });
  });

  test(`TypeScript ${mode} consumers can use the emitted declarations`, () => {
    const path = resolve(
      __dirname,
      mode === 'commonjs' ? 'consumer.cts' : 'consumer.mts',
    );
    const source = `import { DiBag, type Bag } from 'di-bag';
      const bag = DiBag.begin().add({
        value: DiBag.withDisposal(async () => 42, value => { const n: number = value; void n; }),
        clock: () => ({ now() { return 42; } }),
        service: ({ clock }: { clock: { now(): number } }) => ({
          stamp() { return clock.now(); },
        }),
      }).end();
      const value: Promise<number> = bag.resolve('value');
      const scoped = bag.fork(['clock'], {
        clock: () => ({ now() { return 7; } }),
      });
      const stamp = scoped.resolve('service').stamp();
      type Assert<T extends true> = T;
      type Equal<A, B> = (<T>() => T extends A ? 1 : 2) extends
        (<T>() => T extends B ? 1 : 2) ? true : false;
      type Stamp = Assert<Equal<typeof stamp, number>>;
      const replaced = DiBag.begin().add({ clock: () => 1 })
        .replace('clock', () => ({ now() { return 7; } })).end();
      const clock = replaced.resolve('clock');
      type Clock = Assert<Equal<typeof clock, { now(): number }>>;
      const fresh: typeof bag = bag.fork();
      const typed: Bag<{ clock: () => { now(): number } }> = replaced;
      void [value, stamp, fresh, typed, scoped.close(), bag.close()];`;
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

for (const specifier of ['di-bag', '../src/di-bag']) {
  test(`unchecked construction is rejected through ${specifier}`, () => {
    const path = resolve(__dirname, 'unchecked-consumer.cts');
    const source = `import { Bag } from '${specifier}'; new Bag({ value: () => 42 });`;
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
    const errors = ts.getPreEmitDiagnostics(ts.createProgram([path], options, host));
    // The internal constructor shape may add consumer diagnostics; the export
    // itself must still prohibit value usage, with no declaration-file errors.
    const typeOnlyErrors = errors.filter(error => error.code === 1362);
    expect(typeOnlyErrors).toHaveLength(1);
    expect(typeOnlyErrors[0]?.file?.fileName).toBe(path);
    expect(errors.every(error => error.file?.fileName === path)).toBe(true);
    expect(ts.flattenDiagnosticMessageText(typeOnlyErrors[0]!.messageText, '\n'))
      .toContain("cannot be used as a value because it was exported using 'export type'");
  });
}
