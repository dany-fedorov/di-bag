import { expect, test } from 'bun:test';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { DiBag } from '../src';
import { evaluateDenoChild, runDenoLane, type PackedArchive } from '../scripts/platform-evidence';
import { portableContract, validatePortableInspection } from './platform/portable/contract';

test('portable root contract has host-independent semantics', async () => {
  await expect(portableContract(DiBag)).resolves.toEqual({
    aliasCanonical: true,
    rootOnce: true,
    scopedOnce: true,
    transientDistinct: true,
    cleanupLog: ['scoped', 'transient-2', 'transient-1', 'root'],
    rawPromiseIdentity: true,
    rawDisposerIdentity: true,
    inspectionFrozen: true,
    metadataFrozen: true,
  });
});

test('portable inspection proof rejects nonobjects and inexact or unfrozen metadata', () => {
  const validMetadata = Object.freeze({ portable: true });
  expect(validatePortableInspection(Object.freeze({ metadata: validMetadata }))).toEqual({
    inspectionFrozen: true,
    metadataFrozen: true,
  });
  for (const inspection of [undefined, null, true, 1, 'snapshot']) {
    expect(validatePortableInspection(inspection)).not.toEqual({ inspectionFrozen: true, metadataFrozen: true });
  }
  for (const metadata of [undefined, null, true, 1, 'metadata', {}, { portable: false }, { portable: true, extra: true }]) {
    expect(validatePortableInspection(Object.freeze({ metadata }))).not.toEqual({ inspectionFrozen: true, metadataFrozen: true });
  }
  const symbolMetadata = Object.freeze({ portable: true, [Symbol('extra')]: true });
  const hiddenMetadata = { portable: true };
  Object.defineProperty(hiddenMetadata, 'extra', { value: true });
  Object.freeze(hiddenMetadata);
  for (const metadata of [symbolMetadata, hiddenMetadata]) {
    expect(validatePortableInspection(Object.freeze({ metadata }))).not.toEqual({ inspectionFrozen: true, metadataFrozen: true });
  }
  expect(validatePortableInspection({ metadata: validMetadata })).not.toEqual({ inspectionFrozen: true, metadataFrozen: true });
  expect(validatePortableInspection(Object.freeze({ metadata: { portable: true } })))
    .not.toEqual({ inspectionFrozen: true, metadataFrozen: true });
});

const portableResult = {
  aliasCanonical: true as const,
  cleanupLog: ['scoped', 'transient-2', 'transient-1', 'root'] as const,
  inspectionFrozen: true as const,
  metadataFrozen: true as const,
  rawDisposerIdentity: true as const,
  rawPromiseIdentity: true as const,
  rootOnce: true as const,
  scopedOnce: true as const,
  transientDistinct: true as const,
};

test('Deno child validation requires canonical output from the local installed archive', () => {
  const consumer = mkdtempSync(join(tmpdir(), 'di-bag-deno-evaluator-'));
  const installed = join(consumer, 'node_modules', 'di-bag');
  mkdirSync(join(installed, 'dist'), { recursive: true });
  writeFileSync(join(installed, 'dist', 'index.js'), 'export {};\n');
  const local = `file://${installed}/dist/index.js`;
  const expected = { lane: 'deno-root', resolvedDiBag: local, result: portableResult };
  const stdout = `${JSON.stringify(expected)}\n`;

  expect(evaluateDenoChild(installed, { status: 0, signal: null, stderr: '', stdout }))
    .toEqual({ status: 'pass' });
  expect(evaluateDenoChild(installed, { status: 0, signal: null, stderr: '', stdout: `${stdout}noise` }))
    .toEqual({ status: 'fail', reason: 'child stdout is not one canonical JSON object' });
  expect(evaluateDenoChild(installed, { status: 0, signal: null, stderr: '', stdout: `${JSON.stringify({ ...expected, resolvedDiBag: 'file:///tmp/foreign/dist/index.js' })}\n` }))
    .toEqual({ status: 'fail', reason: 'Deno resolved di-bag outside the local archive install' });
  expect(evaluateDenoChild(installed, { status: 0, signal: null, stderr: 'warning', stdout }))
    .toEqual({ status: 'fail', reason: 'child stderr is not empty' });
  expect(evaluateDenoChild(installed, { status: 0, signal: null, stderr: '', stdout: `${JSON.stringify({ ...expected, result: { ...portableResult, rootOnce: false } })}\n` }))
    .toEqual({ status: 'fail', reason: 'child result mismatch' });
  expect(evaluateDenoChild(installed, { status: 9, signal: null, stderr: '', stdout }))
    .toEqual({ status: 'fail', reason: 'child exited with status 9' });
  expect(evaluateDenoChild(installed, { status: null, signal: 'SIGTERM', stderr: '', stdout }))
    .toEqual({ status: 'fail', reason: 'child terminated by SIGTERM' });
  expect(evaluateDenoChild(installed, { status: 0, signal: null, stderr: '', stdout: `${JSON.stringify({ ...expected, lane: 'other' })}\n` }))
    .toEqual({ status: 'fail', reason: 'child lane mismatch' });
  rmSync(consumer, { recursive: true, force: true });
});

test('Deno child validation fails closed when the expected installation is absent', () => {
  const foreign = mkdtempSync(join(tmpdir(), 'di-bag-deno-foreign-'));
  const resolved = join(foreign, 'index.js');
  writeFileSync(resolved, 'export {};\n');
  const expected = {
    lane: 'deno-root',
    resolvedDiBag: `file://${resolved}`,
    result: portableResult,
  };
  expect(evaluateDenoChild('/tmp/missing-di-bag', {
    status: 0,
    signal: null,
    stderr: '',
    stdout: `${JSON.stringify(expected)}\n`,
  })).toEqual({ status: 'fail', reason: 'Deno resolved di-bag outside the local archive install' });
  rmSync(foreign, { recursive: true, force: true });
});

test('an unprovisioned Deno pin yields an explicit unavailable row without touching the archive', async () => {
  const archive = { path: '/missing/archive.tgz', packageTree: '/missing/tree', sha256: '0'.repeat(64), files: [] } satisfies PackedArchive;
  const deno = { status: 'unavailable', reason: 'not-provisioned' } as const;
  await expect(runDenoLane(archive, deno)).resolves.toMatchObject({
    lane: 'deno-root',
    status: 'unavailable',
    reason: 'not-provisioned',
  });
});
