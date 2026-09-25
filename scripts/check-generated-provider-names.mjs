import { readFileSync } from 'node:fs';
import ts from 'typescript';

const retired = /\b(?:fromFactory|fromSyncFactory|fromAsyncFactory|fromFunction|fromClass|fromPlugin|AcquisitionMode|AcquisitionContext|nativePromise|modeOptions)\b|\.token\s*\(|\.of\s*</;
let findings = 0;
for (const file of process.argv.slice(2)) {
  const source = readFileSync(file, 'utf8');
  const tree = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true, file.endsWith('x') ? ts.ScriptKind.TSX : ts.ScriptKind.TS);
  const visit = node => {
    if ((ts.isStringLiteralLike(node) || ts.isTemplateLiteralToken(node)) && retired.test(node.text)) {
      const { line, character } = tree.getLineAndCharacterOfPosition(node.getStart(tree));
      console.error(`${file}:${line + 1}:${character + 1}: generated source retains ${node.text.match(retired)?.[0]}`);
      findings++;
    }
    ts.forEachChild(node, visit);
  };
  visit(tree);
}
if (findings) process.exitCode = 1;
