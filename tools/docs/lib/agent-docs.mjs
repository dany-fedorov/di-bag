import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { dirname, join, posix, resolve } from 'node:path';
import ts from 'typescript';

export const siteUrl = 'https://dany-fedorov.github.io/di-bag/';
export const agentsBudget = 150;
export const cardBudget = 400;
export const recipeBudget = 60;
export const familyIds = ['missing-service', 'unsatisfied-consumer', 'root-capture', 'unknown-key', 'structural-thenable', 'wrong-shape', 'wrong-override'];

/** VitePress's heading slugifier, so implicit anchors match the rendered site. */
export function slugify(text) {
  return text.normalize('NFKD').replace(/[\u0300-\u036F]/g, '').replace(/[\u0000-\u001f]/g, '')
    .replace(/[\s~`!@#$%^&*()\-_+=[\]{}|\\;:"'\u201c\u201d\u2018\u2019<>,.?/]+/g, '-').replace(/-{2,}/g, '-')
    .replace(/^-+|-+$/g, '').replace(/^(\d)/, '_$1').toLowerCase();
}

/** Headings and fenced blocks in document order; fences hide heading-like lines. */
export function parseMarkdown(markdown) {
  const headings = [];
  const blocks = [];
  const lines = markdown.split('\n');
  let heading;
  for (let index = 0; index < lines.length; index++) {
    const fence = lines[index].match(/^```(\S*)\s*$/);
    if (fence) {
      const start = index;
      while (++index < lines.length && !/^```\s*$/.test(lines[index]));
      if (index === lines.length) throw new Error(`unclosed code fence at line ${start + 1}`);
      blocks.push({ lang: fence[1], code: lines.slice(start + 1, index).join('\n') + '\n', line: start + 1, heading: heading?.id });
      continue;
    }
    const match = lines[index].match(/^(#{1,6})\s+(.*?)\s*$/);
    if (!match) continue;
    const explicit = match[2].match(/^(.*?)\s*\{#([^}\s]+)\}$/);
    const text = explicit ? explicit[1] : match[2];
    heading = { level: match[1].length, text, id: explicit ? explicit[2] : slugify(text.replace(/`/g, '')), explicit: !!explicit, line: index + 1 };
    headings.push(heading);
  }
  return { headings, blocks };
}

const markerPattern = /^\/\/ (?:(continues|expect-error): (.+)|((?:[\w.-]+\/)*[\w.-]+\.(?:ts|mts|tsx)))\s*$/;

/** Leading marker lines: `continues`, `expect-error`, and a file path such as `// src/app.ts`. */
export function readMarkers(code) {
  const markers = {};
  const lines = code.split('\n');
  let index = 0;
  for (; index < lines.length; index++) {
    const match = lines[index].match(markerPattern);
    if (!match) break;
    const name = match[3] ? 'file' : match[1] === 'continues' ? 'continues' : 'expectError';
    if (markers[name] !== undefined) throw new Error(`repeated ${name} marker`);
    markers[name] = match[3] ?? match[2].trim();
  }
  return markers;
}

/** `@example` fences in JSDoc comments; an example without imports gets the facade import. */
export function jsDocExamples(source) {
  const examples = [];
  for (const comment of source.matchAll(/\/\*\*[\s\S]*?\*\//g)) {
    const body = comment[0].slice(3, -2).split('\n').map(line => line.replace(/^\s*\* ?/, ''));
    const offset = source.slice(0, comment.index).split('\n').length;
    for (let index = 0; index < body.length; index++) {
      if (!/^@example\b/.test(body[index])) continue;
      let cursor = index + 1;
      while (cursor < body.length && !/^@\w/.test(body[cursor])) {
        const fence = body[cursor].match(/^```(ts|typescript)\s*$/);
        if (!fence) { cursor++; continue; }
        const start = cursor;
        while (++cursor < body.length && !/^```\s*$/.test(body[cursor]));
        const code = body.slice(start + 1, cursor).join('\n') + '\n';
        examples.push({ line: offset + start, code: /^\s*import\s/m.test(code) ? code : `import { DiBag } from 'di-bag';\n${code}` });
        cursor++;
      }
    }
  }
  return examples;
}

function listMarkdown(directory) {
  return existsSync(directory) ? readdirSync(directory).filter(file => file.endsWith('.md')).sort() : [];
}

function listSources(directory, prefix = '') {
  return readdirSync(join(directory, prefix), { withFileTypes: true }).flatMap(entry => {
    const file = posix.join(prefix, entry.name);
    if (entry.isDirectory()) return listSources(directory, file);
    return file.endsWith('.ts') && !file.endsWith('.d.ts') ? [file] : [];
  }).sort();
}

/**
 * Every checked TypeScript snippet as a file. Blocks with a file marker share one directory
 * per page, so a recipe's `check.ts` can import the `module.ts` shown earlier on the page.
 */
export function collectSnippets(root) {
  // The API card is generated from the `@example` comments checked below.
  const pages = [...(existsSync(join(root, 'AGENTS.md')) ? ['AGENTS.md'] : []),
    ...listMarkdown(join(root, 'docs/agent')).filter(file => file !== 'api-card.md').map(file => `docs/agent/${file}`)];
  const snippets = [];
  const errors = [];
  for (const page of pages) {
    const { headings, blocks } = parseMarkdown(readFileSync(join(root, page), 'utf8'));
    const typescript = blocks.filter(block => block.lang === 'ts' || block.lang === 'typescript');
    const resolved = new Map();
    const paths = new Set();
    for (const block of typescript) {
      const where = `${page}:${block.line}`;
      let markers;
      try { markers = readMarkers(block.code); } catch (error) { errors.push(`${where}: ${error.message}`); continue; }
      let code = block.code;
      let directory = page.replace(/\.md$/, '');
      if (markers.continues !== undefined) {
        if (!headings.some(heading => heading.id === markers.continues)) {
          errors.push(`${where}: continues unknown heading #${markers.continues}`);
          continue;
        }
        const earlier = typescript.filter(other => other.line < block.line && other.heading === markers.continues && resolved.has(other));
        if (!earlier.length) {
          errors.push(`${where}: no earlier TypeScript block under #${markers.continues}`);
          continue;
        }
        const target = resolved.get(earlier.at(-1));
        code = `${target.code}\n${code}`;
        // Relative imports in the continued text keep resolving from its file's directory.
        directory = target.directory;
      }
      // A counterexample is a variant of its named file: it sits beside it without replacing it.
      const file = markers.continues !== undefined || !markers.file ? posix.join(directory, `block-${block.line}.ts`)
        : markers.expectError !== undefined ? posix.join(directory, posix.dirname(markers.file), `expect-error-${block.line}.ts`)
          : posix.join(directory, markers.file);
      // An expect-error block is a counterexample; continuing it would inherit the failure.
      if (markers.expectError === undefined) resolved.set(block, { code, directory: posix.dirname(file) });
      if (paths.has(file)) {
        errors.push(`${where}: file ${markers.file} appears twice on the page`);
        continue;
      }
      paths.add(file);
      snippets.push({ where, file, code, expectError: markers.expectError });
    }
  }
  for (const file of listSources(join(root, 'src'))) {
    for (const example of jsDocExamples(readFileSync(join(root, 'src', file), 'utf8'))) {
      snippets.push({ where: `src/${file}:${example.line}`, file: `src/${file.replace(/\.ts$/, '')}/example-${example.line}.ts`, code: example.code });
    }
  }
  return { snippets, errors };
}

/** Emit the public declarations the way `npm run build` does, into a consumer-shaped package. */
export function writeDeclarationPackage(root, packageDirectory) {
  const config = ts.getParsedCommandLineOfConfigFile(join(root, 'tsconfig.build.json'), {}, {
    ...ts.sys,
    onUnRecoverableConfigFileDiagnostic: diagnostic => { throw new Error(ts.flattenDiagnosticMessageText(diagnostic.messageText, '\n')); },
  });
  const options = { ...config.options, noEmit: false, declaration: true, emitDeclarationOnly: true, outDir: join(packageDirectory, 'dist') };
  const program = ts.createProgram(config.fileNames, options);
  const result = program.emit();
  const failures = [...ts.getPreEmitDiagnostics(program), ...result.diagnostics].filter(item => item.category === ts.DiagnosticCategory.Error);
  if (failures.length) throw new Error(`declaration emit failed:\n${failures.map(format).join('\n')}`);
  const manifest = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'));
  writeFileSync(join(packageDirectory, 'package.json'), JSON.stringify({ name: manifest.name, type: manifest.type, types: manifest.types, exports: manifest.exports }, null, 2));
}

function format(diagnostic) {
  const text = ts.flattenDiagnosticMessageText(diagnostic.messageText, '\n');
  if (!diagnostic.file || diagnostic.start === undefined) return `TS${diagnostic.code}: ${text}`;
  const { line } = diagnostic.file.getLineAndCharacterOfPosition(diagnostic.start);
  return `line ${line + 1}: TS${diagnostic.code}: ${text}`;
}

/**
 * Type-check all snippets in one program against an installed-looking package at
 * `<workspace>/node_modules/di-bag`. Unmarked blocks must compile; expect-error blocks
 * must report a diagnostic containing their fragment.
 */
export function checkSnippets(snippets, workspace, typeRoots) {
  const files = new Map(snippets.map(snippet => [resolve(workspace, snippet.file), snippet]));
  // Real files keep module resolution identical to a consumer project's.
  for (const [path, snippet] of files) {
    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(path, snippet.code);
  }
  writeFileSync(join(workspace, 'package.json'), '{ "type": "module" }\n');
  const options = {
    strict: true,
    noEmit: true,
    skipLibCheck: true,
    noUncheckedIndexedAccess: true,
    exactOptionalPropertyTypes: true,
    target: ts.ScriptTarget.ES2022,
    module: ts.ModuleKind.NodeNext,
    moduleResolution: ts.ModuleResolutionKind.NodeNext,
    typeRoots,
    types: ['node'],
    // Every excerpt checks independently; shared global names would otherwise collide.
    moduleDetection: ts.ModuleDetectionKind.Force,
  };
  const program = ts.createProgram([...files.keys()], options);
  const errors = [...program.getOptionsDiagnostics(), ...program.getGlobalDiagnostics()].map(item => `compiler: ${format(item)}`);
  for (const [path, snippet] of files) {
    const source = program.getSourceFile(path);
    const diagnostics = [...program.getSyntacticDiagnostics(source), ...program.getSemanticDiagnostics(source)];
    if (snippet.expectError === undefined) {
      for (const diagnostic of diagnostics) errors.push(`${snippet.where}: ${format(diagnostic)}`);
    } else if (!diagnostics.some(diagnostic => ts.flattenDiagnosticMessageText(diagnostic.messageText, '\n').includes(snippet.expectError))) {
      errors.push(`${snippet.where}: expected a diagnostic containing ${JSON.stringify(snippet.expectError)}; got ${diagnostics.length ? diagnostics.map(format).join(' | ') : 'none'}`);
    }
  }
  return errors;
}

export function checkBudgets(root) {
  const errors = [];
  for (const [file, budget] of [['AGENTS.md', agentsBudget], ['docs/agent/api-card.md', cardBudget]]) {
    const path = join(root, file);
    if (!existsSync(path)) {
      if (file === 'AGENTS.md') errors.push('AGENTS.md is missing');
      continue;
    }
    const lines = readFileSync(path, 'utf8').replace(/\n$/, '').split('\n').length;
    if (lines > budget) errors.push(`${file} has ${lines} lines; the budget is ${budget}`);
  }
  const recipes = join(root, 'docs/agent/recipes.md');
  if (existsSync(recipes)) {
    const text = readFileSync(recipes, 'utf8').replace(/\n$/, '');
    const sections = parseMarkdown(text).headings.filter(heading => heading.level === 2);
    const total = text.split('\n').length;
    sections.forEach((heading, index) => {
      // A recipe runs from its heading to the next recipe heading, blank separator excluded.
      const lines = (sections[index + 1]?.line ?? total + 1) - heading.line - (sections[index + 1] ? 1 : 0);
      if (lines >= recipeBudget) errors.push(`docs/agent/recipes.md#${heading.id} has ${lines} lines; recipes stay under ${recipeBudget}`);
    });
  }
  return errors;
}

/** The layout's home is the modularity guide; AGENTS.md carries a byte-identical copy. */
export function checkLayoutBlock(root) {
  const guide = parseMarkdown(readFileSync(join(root, 'docs/guides/examples-modularity.md'), 'utf8'));
  const home = guide.blocks.find(block => block.lang === 'text' && block.heading === 'recommended-module-layout');
  if (!home) return ['docs/guides/examples-modularity.md: no text block under "Recommended module layout"'];
  if (!existsSync(join(root, 'AGENTS.md'))) return [];
  const copies = parseMarkdown(readFileSync(join(root, 'AGENTS.md'), 'utf8')).blocks.filter(block => block.lang === 'text');
  if (copies.length !== 1) return [`AGENTS.md must contain exactly one text block (the layout); found ${copies.length}`];
  return copies[0].code === home.code ? [] : ['AGENTS.md layout block differs from docs/guides/examples-modularity.md "Recommended module layout"; copy it byte for byte'];
}

export const codeFragment = code => code.toLowerCase().replace(/_/g, '-');

/** Codes raised in src and code-anchored sections of the errors page must be the same set. */
export function checkErrorCoverage(root) {
  const codes = new Set();
  for (const file of listSources(join(root, 'src'))) {
    for (const match of readFileSync(join(root, 'src', file), 'utf8').matchAll(/'(DI_BAG_[A-Z_]+)'/g)) codes.add(match[1]);
  }
  const page = join(root, 'docs/agent/errors.md');
  if (!existsSync(page)) return ['docs/agent/errors.md is missing'];
  const { headings } = parseMarkdown(readFileSync(page, 'utf8'));
  const errors = [];
  const documented = new Set();
  for (const heading of headings.filter(item => item.level > 1)) {
    if (!heading.explicit) errors.push(`docs/agent/errors.md:${heading.line}: heading "${heading.text}" needs an explicit {#id}`);
    if (!/^DI_BAG_[A-Z_]+$/.test(heading.text)) continue;
    if (heading.id !== codeFragment(heading.text)) errors.push(`docs/agent/errors.md:${heading.line}: ${heading.text} must use {#${codeFragment(heading.text)}}`);
    documented.add(heading.text);
  }
  for (const code of [...codes].sort()) if (!documented.has(code)) errors.push(`docs/agent/errors.md: no section for ${code}`);
  for (const code of [...documented].sort()) if (!codes.has(code)) errors.push(`docs/agent/errors.md: section ${code} is not raised in src`);
  const ids = new Set(headings.map(heading => heading.id));
  for (const id of familyIds) if (!ids.has(id)) errors.push(`docs/agent/errors.md: missing family section #${id}`);
  return errors;
}

/**
 * Site URLs cited in library source, which messages carry to agents. Compile-time messages
 * spell the page once as `type ErrorsPage` and the section as `SeeErrors<'id'>`; expand those too.
 */
export function messageUrls(root) {
  const urls = new Map();
  const pattern = new RegExp(`${siteUrl.replace(/[.]/g, '\\.')}[^\\s'"\`)]*`, 'g');
  const sources = listSources(join(root, 'src')).map(file => [`src/${file}`, readFileSync(join(root, 'src', file), 'utf8')]);
  const page = sources.map(([, text]) => /type ErrorsPage = '([^']+)'/.exec(text)?.[1]).find(Boolean);
  for (const [file, text] of sources) {
    for (const match of text.matchAll(pattern)) if (!urls.has(match[0])) urls.set(match[0], file);
    for (const match of text.matchAll(/SeeErrors<'([^']+)'>/g)) {
      const url = page ? `${page}#${match[1]}` : `SeeErrors<'${match[1]}'> without type ErrorsPage`;
      if (!urls.has(url)) urls.set(url, file);
    }
  }
  return urls;
}

/** Split a site URL into candidate rendered files (VitePress emits `.html`) and a fragment. */
export function siteTarget(url) {
  const parsed = new URL(url);
  const path = decodeURIComponent(parsed.pathname.slice(new URL(siteUrl).pathname.length));
  const candidates = !path || path.endsWith('/') ? [`${path}index.html`] : path.endsWith('.html') ? [path] : [`${path}.html`, `${path}/index.html`];
  return { candidates, fragment: decodeURIComponent(parsed.hash.slice(1)) };
}

/** Resolve message URLs against Markdown sources before building, using the site's page map. */
export function checkMessageUrlsInSources(root, pages) {
  const routes = new Map([...pages].map(([source, route]) => [route.replace(/\.md$/, '.html'), source]));
  const errors = [];
  for (const [url, file] of messageUrls(root)) {
    const { candidates, fragment } = siteTarget(url);
    const source = candidates.map(candidate => routes.get(candidate)).find(Boolean);
    if (!source) { errors.push(`${file}: ${url} names no site page`); continue; }
    if (fragment && !parseMarkdown(readFileSync(join(root, source), 'utf8')).headings.some(heading => heading.id === fragment)) {
      errors.push(`${file}: ${url} names a missing anchor in ${source}`);
    }
  }
  return errors;
}

/** Resolve message URLs against the rendered HTML, which is what a reader's browser gets. */
export function checkMessageUrlsInBuild(root, dist) {
  const errors = [];
  for (const [url, file] of messageUrls(root)) {
    const { candidates, fragment } = siteTarget(url);
    const page = candidates.map(candidate => join(dist, candidate)).find(existsSync);
    if (!page) { errors.push(`${file}: ${url} is not a built page`); continue; }
    if (fragment && !readFileSync(page, 'utf8').includes(`id="${fragment}"`)) errors.push(`${file}: ${url} has no rendered anchor`);
  }
  return errors;
}
