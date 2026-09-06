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
        const feature = DiBag.module().add({
          answer: DiBag.withDisposal(() => 42, value => { disposed = value; }),
          privateValue: () => 7,
        }).exports(['answer']);
        const bag = DiBag.begin().install(feature.rename('answer', 'result')).end();
        const answer = bag.resolve('result');
        await bag.close();
        console.log(JSON.stringify({ answer, disposed, publiclyConstructible: Object.hasOwn(packageExports, 'Bag') || Object.hasOwn(packageExports, 'Module') }));
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
    const source = `import { DiBag, type Bag, type Module, type ModuleProvides, type ModuleRequires } from 'di-bag';
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
      const feature = DiBag.module().add({
        clock: () => ({ now() { return Number(42); }, extra() { return true; } }),
        privateReader: ({ clock, logger }: { clock: { extra(): boolean }; logger: { log(message: string): void } }) => clock.extra(),
        read: ({ privateReader }: { privateReader: boolean }) => ({ read() { return privateReader; } }),
        promised: async () => 7,
      }).exports(['clock', 'read', 'promised']);
      type Public = ModuleProvides<typeof feature>;
      type Required = ModuleRequires<typeof feature>;
      type RequiredKeys = Assert<Equal<keyof Required, 'logger'>>;
      type PublicPromise = Assert<Equal<Public['promised'], Promise<number>>>;
      const annotated: typeof feature = feature;
      const installed = DiBag.begin().install(annotated).add({ logger: () => ({ log(_message: string) {} }) });
      const composed = installed.end();
      const child = composed.fork(['clock'], { clock: () => ({ now() { return 7; }, extra() { return false; } }) });
      const result = child.resolve('read').read();
      type Result = Assert<Equal<typeof result, boolean>>;
      const modulePromise: Promise<number> = child.resolve('promised');
      const asyncOverrides = {
        clock: () => ({ now() { return Number(7); }, extra() { return true; }, richer() { return 9; } }),
        promised: async ({ clock }: { clock: { richer(): number } }) => clock.richer(),
      };
      const asyncFork = composed.fork(['clock', 'promised'], asyncOverrides);
      const asyncPromise = asyncFork.resolve('promised');
      type AsyncPromise = Assert<Equal<typeof asyncPromise, Promise<number>>>;
      // @ts-expect-error Private providers are not public slots.
      child.resolve('privateReader');
      // @ts-expect-error All local provider requirements survive sealing.
      DiBag.begin().install(feature).end();
      // @ts-expect-error Private consumers survive host replacement.
      installed.replace('clock', () => ({ now() { return 7; } }));
      // @ts-expect-error A visible contract annotation cannot erase latent constraints.
      const erasedModule: Module<Public, Required> = feature;
      // @ts-expect-error Plain Bag annotations cannot erase installed constraints.
      const erasedBag: Bag<{ clock: () => Public['clock']; read: () => Public['read']; promised: () => Public['promised']; logger: () => Required['logger'] }> = composed;
      const plainBuilder = DiBag.begin().add({
        clock: (): Public['clock'] => ({ now() { return 1; }, extra() { return true; } }),
        read: (): Public['read'] => ({ read() { return true; } }),
        promised: async () => 7,
        logger: (): Required['logger'] => ({ log(_message: string) {} }),
      });
      // @ts-expect-error Builder annotation cannot erase installed constraints.
      const erasedBuilder: typeof plainBuilder = installed;
      const selfContained = DiBag.module().add({ a: () => 1, b: () => 2 }).exports(['a', 'b']);
      // @ts-expect-error The provided contract is invariant even without retained requirements.
      const fewerProvides: Module<{ a: number }, {}> = selfContained;
      // @ts-expect-error Structural copies lose module identity.
      DiBag.begin().install({ ...feature });
      // @ts-expect-error Export selections require a finite tuple.
      DiBag.module().add({ value: () => 1 }).exports(['value'] as string[]);
      // @ts-expect-error Renames cannot hide another exported slot.
      feature.rename('clock', 'read');
      const renamed = DiBag.begin().install(feature.rename('clock', 'other')).add({ logger: () => ({ log(_message: string) {} }) });
      // @ts-expect-error Renamed public references retain their consumer constraints.
      renamed.replace('other', () => ({ now() { return 7; } }));
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

for (const [name, specifier] of [['Bag', 'di-bag'], ['Bag', '../src/di-bag'], ['Module', 'di-bag'], ['Module', '../src/module']]) {
  test(`unchecked ${name} construction is rejected through ${specifier}`, () => {
    const path = resolve(__dirname, 'unchecked-consumer.cts');
    const source = `import { ${name} } from '${specifier}'; new ${name}({ value: () => 42 });`;
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
