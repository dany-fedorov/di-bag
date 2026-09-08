import { describe, expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = resolve(__dirname, '..');
const packageManifest = JSON.parse(readFileSync(resolve(root, 'package.json'), 'utf8')) as {
  name: string;
  version: string;
  exports: Record<string, unknown>;
  dependencies?: Record<string, string>;
  peerDependencies?: Record<string, string>;
  optionalDependencies?: Record<string, string>;
  bundledDependencies?: readonly string[];
};

const packageNames = ['sas-box', 'val-box', 'di-bag'] as const;
const authorizationHeading = '## DO NOT RUN without fresh explicit authorization';

function onlineCommands(version: string): readonly string[] {
  return [
    ...packageNames.map(name =>
      `npm view ${name}@${version} version --registry=https://registry.npmjs.org`),
    'npm login --registry=https://registry.npmjs.org',
    `npm publish /tmp/di-bag-release-candidate/sas-box-${version}.tgz --access public --provenance`,
    `npm dist-tag add sas-box@${version} latest --registry=https://registry.npmjs.org`,
    `npm publish /tmp/di-bag-release-candidate/val-box-${version}.tgz --access public --provenance`,
    `npm dist-tag add val-box@${version} latest --registry=https://registry.npmjs.org`,
    `npm publish /tmp/di-bag-release-candidate/di-bag-${version}.tgz --access public --provenance`,
    `npm dist-tag add di-bag@${version} latest --registry=https://registry.npmjs.org`,
  ];
}

function validatePublishingDocument(document: string, version: string): string[] {
  const failures: string[] = [];
  const headingIndex = document.indexOf(authorizationHeading);
  if (headingIndex < 0) failures.push('missing authorization heading');
  if (headingIndex >= 0 && document.indexOf(authorizationHeading, headingIndex + 1) >= 0)
    failures.push('authorization heading must occur exactly once');
  const beforeAppendix = headingIndex < 0 ? document : document.slice(0, headingIndex);
  const appendix = headingIndex < 0 ? '' : document.slice(headingIndex);
  for (const token of [
    'npm view', 'npm whoami', 'npm login', 'npm publish', 'npm dist-tag',
    'npm token', 'npm config', 'npm audit', 'git tag', 'git push',
    '--provenance', '.npmrc', '_authToken',
  ]) if (beforeAppendix.includes(token)) failures.push(`online token precedes authorization heading: ${token}`);
  for (const command of onlineCommands(version)) {
    const count = document.split(command).length - 1;
    if (count !== 1) failures.push(`expected command exactly once: ${command}`);
    if (beforeAppendix.includes(command)) failures.push(`online command precedes authorization heading: ${command}`);
    if (!appendix.includes(command)) failures.push(`online command missing from appendix: ${command}`);
  }
  for (const required of [
    '/tmp/di-bag-release-candidate',
    '.related-repos/sas-box',
    '.related-repos/val-box',
    'npm install --offline --ignore-scripts --no-audit --no-fund --no-package-lock',
    'Registry version/owner/access/tag/provenance status is unavailable',
    'npm versions are immutable',
  ]) if (!beforeAppendix.includes(required)) failures.push(`missing local workflow fact: ${required}`);
  return failures;
}

function appendixCommands(document: string): readonly string[] {
  const appendix = document.slice(document.indexOf(authorizationHeading));
  const matches = appendix.match(/```bash\n([\s\S]*?)\n```\s*$/);
  return matches?.[1]?.split('\n') ?? [];
}

describe('release documentation contract', () => {
  test('release documents match the frozen package and gate every online command', () => {
    const changelog = readFileSync(resolve(root, 'CHANGELOG.md'), 'utf8');
    const publishing = readFileSync(resolve(root, 'PUBLISHING.md'), 'utf8');
    expect(packageManifest).toMatchObject({ name: 'di-bag', version: '0.1.0' });
    expect(changelog.match(new RegExp(`^## ${packageManifest.version}$`, 'gm'))).toHaveLength(1);
    expect(changelog).not.toContain('## Unreleased');
    expect(validatePublishingDocument(publishing, packageManifest.version)).toEqual([]);
    expect(appendixCommands(publishing)).toEqual(onlineCommands(packageManifest.version));
  });

  test('the publication boundary rejects stale, missing, duplicated, and misplaced commands', () => {
    const publishing = readFileSync(resolve(root, 'PUBLISHING.md'), 'utf8');
    const command = onlineCommands(packageManifest.version)[0]!;
    expect(validatePublishingDocument(publishing.replaceAll(packageManifest.version, '9.9.9'), packageManifest.version))
      .toContain(`expected command exactly once: ${command}`);
    expect(validatePublishingDocument(publishing.replace(command, ''), packageManifest.version))
      .toContain(`expected command exactly once: ${command}`);
    expect(validatePublishingDocument(`${command}\n${publishing}`, packageManifest.version))
      .toContain(`online command precedes authorization heading: ${command}`);
    expect(validatePublishingDocument(`${publishing}\n${command}`, packageManifest.version))
      .toContain(`expected command exactly once: ${command}`);
    expect(validatePublishingDocument(publishing.replace(authorizationHeading, ''), packageManifest.version))
      .toContain('missing authorization heading');
    expect(validatePublishingDocument(publishing.replace(authorizationHeading, `${authorizationHeading}\n${authorizationHeading}`), packageManifest.version))
      .toContain('authorization heading must occur exactly once');
    expect(validatePublishingDocument(publishing.replaceAll('/tmp/di-bag-release-candidate', '/tmp/other'), packageManifest.version))
      .toContain('missing local workflow fact: /tmp/di-bag-release-candidate');
    for (const [prohibited, token] of [
      ['npm whoami --registry=https://registry.npmjs.org', 'npm whoami'],
      ['npm token list', 'npm token'],
      ['npm config set //registry.npmjs.org/:_authToken secret', 'npm config'],
      ['git tag v0.1.0', 'git tag'],
      ['git push origin feat/v0.1', 'git push'],
      ['npm audit signatures --provenance', 'npm audit'],
      ['printf secret > ~/.npmrc', '.npmrc'],
    ]) {
      expect(validatePublishingDocument(`${prohibited}\n${publishing}`, packageManifest.version))
        .toContain(`online token precedes authorization heading: ${token}`);
    }
  });

  test('public docs state entry-point, adapter, acquisition, ownership, and release limits', () => {
    const readme = readFileSync(resolve(root, 'README.md'), 'utf8');
    const migration = readFileSync(resolve(root, 'docs/migrations/0.1-to-enterprise.md'), 'utf8');
    const tracker = readFileSync(resolve(root, 'docs/superpowers/plans/2026-09-06-enterprise-di-program.md'), 'utf8');

    expect(readme).not.toContain('The package publishes');
    expect(packageManifest.exports).toEqual({
      './node': { types: './dist/node.d.ts', default: './dist/node.js' },
      '.': { types: './dist/index.d.ts', default: './dist/index.js' },
      './sas-box': { types: './dist/sas-box.d.ts', default: './dist/sas-box.js' },
      './val-box': { types: './dist/val-box.d.ts', default: './dist/val-box.js' },
    });
    expect(packageManifest.dependencies ?? {}).toEqual({});
    expect(packageManifest.peerDependencies ?? {}).toEqual({});
    expect(packageManifest.optionalDependencies ?? {}).toEqual({});
    expect(packageManifest.bundledDependencies ?? []).toEqual([]);
    for (const text of [readme, migration]) {
      for (const entry of ['di-bag', 'di-bag/node', 'di-bag/sas-box', 'di-bag/val-box'])
        expect(text).toContain(`\`${entry}\``);
      for (const fact of ['structural adapters', 'raw', 'native', 'selected scopes', 'non-blocking observers', 'original acquired value'])
        expect(text).toContain(fact);
    }
    expect(readme).toContain('npm run check');
    expect(readme).toContain('npm run check:native');
    expect(migration).toContain('application-owned plugin loading');
    expect(tracker).toContain('Local release-candidate handoff');
    expect(tracker).toContain('registry version and publication remain unavailable');
  });
});
