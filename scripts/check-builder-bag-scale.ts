import { performance } from 'node:perf_hooks';
import ts from 'typescript';
import { compilerProgram, describeDiagnostic, tokenScalePath } from '../tests/compiler.ts';

type Form = 'alias' | 'contribution';
type Shape = 'positional-0.4' | 'bag-0.5';
const forms: readonly Form[] = ['alias', 'contribution'];
const shapes: readonly Shape[] = ['positional-0.4', 'bag-0.5'];
const form = forms.find(value => value === process.argv[2]);
const shape = shapes.find(value => value === process.argv[3]);
const count = Number(process.argv[4]);
if (!form || !shape || process.argv.length !== 5 || !Number.isSafeInteger(count) || count < 1) {
  throw new Error('usage: check-builder-bag-scale.ts <alias|contribution> <positional-0.4|bag-0.5> <positive-count>');
}
const bags = shape === 'bag-0.5';
const aliasChain = (count: number, bags: boolean) => `import { DiBag } from '${process.cwd()}/src';
const base = DiBag.createBuilder().${bags ? 'withServices' : 'register'}({ svc: () => 1 });
const graph = base
${Array.from({ length: count }, (_, index) => bags ? `  .withServiceAlias({ aliasKey: 'alias${index}', targetServiceKey: 'svc' })` : `  .alias('alias${index}', 'svc')`).join('\n')}
  .${bags ? 'buildContainer' : 'build'}();
const last: number = graph.resolve('alias${count - 1}');
`;
const contributionChain = (count: number, bags: boolean) => `import { DiBag } from '${process.cwd()}/src';
const key = Symbol('items');
const items = DiBag.token(key).forCollectionOf<number>();
const graph = DiBag.createBuilder()
${Array.from({ length: count }, (_, index) => bags ? `  .withCollectionContribution({ collectionToken: items, provider: () => ${index} })` : `  .contribute(items, () => ${index})`).join('\n')}
  .${bags ? 'buildContainer' : 'build'}();
const all: readonly number[] = graph.resolveCollection(items);
`;

const source = form === 'alias' ? aliasChain(count, bags) : contributionChain(count, bags);
const start = performance.now();
const program = compilerProgram(tokenScalePath, source);
const diagnostics = ts.getPreEmitDiagnostics(program).map(describeDiagnostic);
console.log(JSON.stringify({
  form, shape, count, typescript: ts.version, node: process.version,
  milliseconds: Math.round(performance.now() - start),
  maxRssMiB: Math.round(process.resourceUsage().maxRSS / 1024),
  diagnostics: diagnostics.map(item => ({ code: item.code, line: item.line, message: item.message })),
  instantiations: program.getInstantiationCount(),
}));
