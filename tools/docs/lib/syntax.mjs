import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import ts from 'typescript';
import { listFiles } from './markdown.mjs';

/** Catch malformed output after Markdown rendering, including member signatures. */
export function verifyRenderedSyntax(root) {
  let blocks = 0;
  const errors = [];
  for (const file of listFiles(root).filter(file => file.endsWith('.md'))) {
    const markdown = readFileSync(join(root, file), 'utf8');
    for (const [, code] of markdown.matchAll(/^```(?:ts|typescript)\n([\s\S]*?)^```/gm)) {
      blocks++;
      const contexts = [code, `interface __Reference {\n${code}\n}`, `type __Reference = ${code}`];
      if (!contexts.some(text => ts.createSourceFile('reference.ts', text, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS).parseDiagnostics.length === 0)) {
        errors.push(`${file}: invalid TypeScript declaration:\n${code.trim()}`);
      }
    }
  }
  if (errors.length) throw new Error(errors.join('\n\n'));
  if (!blocks) throw new Error('No generated TypeScript declaration blocks found');
  return blocks;
}
