/**
 * Evidence probe against sibling source checkouts, not installed package builds.
 * From the di-bag repository root, with application-exception dependencies present:
 * node --import ../application-exception/node_modules/tsx/dist/loader.mjs docs/research/error-boundary-harness-probe.ts
 *
 * Audited commits and setup assumptions are recorded in
 * 2026-09-12-error-boundary-harness-evidence.md.
 * The explicit `any` casts intentionally exercise unchecked JavaScript callers.
 */
import assert from 'node:assert/strict';
import {
  defineException,
  isTypedException,
  toDiagnosticReport,
  toPublicReport,
} from '../../../application-exception/src/index';
import {
  makeCorj,
  makeCorjArray,
  restoreExpectedValues,
} from '../../../caught-object-report-json/src/index';

const Kind = defineException({
  tag: 'tools/Unavailable',
  message: ({ tool }: { tool: string }) => `Unavailable: ${tool}`,
});
const cause = new Error('provider failed');
cause.stack = 'Error: provider failed';
const nested = { value: 1 };
const err = new Kind({
  details: { tool: 'search', token: 'SENSITIVE', nested } as any,
  cause,
});
err.stack = 'tools/Unavailable: Unavailable: search';

const native = new Error('outer', { cause });
assert.equal(JSON.stringify(native), '{}');
const nativeSummary = {
  nativeJson: JSON.stringify(native),
  causeEnumerable: Object.getOwnPropertyDescriptor(err, 'cause')!.enumerable,
};
assert.equal(nativeSummary.causeEnumerable, false);

const invalid = new Kind({ details: {} } as any);
assert.equal(invalid.message, 'Unavailable: undefined');
assert.equal(Object.isFrozen(err.details), true);
nested.value = 2;
assert.equal((err.details as any).nested.value, 2);
const descriptor = Object.getOwnPropertyDescriptor(err, '_tag')!;
assert.equal(descriptor.writable, true);

const raw = JSON.parse(JSON.stringify(err));
assert.equal(raw.cause, undefined);
assert.equal(raw.message, undefined);
assert.equal(isTypedException(raw), false);

const corj = makeCorj(err);
const restored = restoreExpectedValues(corj);
assert.equal((restored.as_json as any)._tag, 'tools/Unavailable');
assert.equal((restored.as_json as any).id, err.id);
assert.equal((restored.as_json as any).timestamp, err.timestamp);
assert.equal((restored.as_json as any).name, err.name);
assert.equal((restored.as_json as any).details.token, 'SENSITIVE');
assert.equal(restored.message, err.message);
assert.equal(restored.children?.[0]?.message, 'provider failed');
assert.equal(restored.children?.[0]?.path, '$.cause');

const diagnostic = toDiagnosticReport(err);
assert.deepEqual((diagnostic.details as any).token, { $appex: 'redacted' });
assert.equal(diagnostic.kind, err._tag);
assert.equal(diagnostic.reference, err.id);
assert.equal(diagnostic.stack, undefined);
assert.deepEqual(Object.keys(toPublicReport(err.id)), [
  'v', 'reference', 'code', 'message',
]);

const Broken = defineException({
  tag: 'Broken',
  message: (_: { n: number }): string => {
    throw new Error('renderer failed');
  },
});
const brokenError = new Broken({ details: { n: 1 } });
assert.ok(toDiagnosticReport(brokenError).messageRenderingError);
assert.equal(JSON.stringify(makeCorj(brokenError)).includes('renderer failed'), false);

let getterCalls = 0;
const getterFailure = new Error('getter failed');
const callbacks: unknown[] = [];
const contexts: unknown[] = [];
const hostile = Object.defineProperty({}, 'message', {
  enumerable: true,
  get() {
    getterCalls++;
    throw getterFailure;
  },
});
const hostileReport = makeCorj(hostile, {
  onError(error, context) {
    callbacks.push(error);
    contexts.push(context);
  },
});
assert.equal(getterCalls, 2);
assert.equal(callbacks.length, 2);
assert.ok(callbacks.every(error => error === getterFailure));
assert.deepEqual(contexts, [
  { stage: 'prop-access', path: '$', key: 'message', prop: 'message' },
  { stage: 'as_json', path: '$', key: 'as_json' },
]);
assert.equal(hostileReport.message, null);
const before = getterCalls;
toDiagnosticReport(hostile);
assert.equal(getterCalls, before);

const bounded = makeCorj(
  { text: 'x'.repeat(10_000) },
  { maxReportSize: 256, metadata: true },
);
const bytes = Buffer.byteLength(JSON.stringify(bounded));
const restoredBytes = Buffer.byteLength(JSON.stringify(restoreExpectedValues(bounded)));
const wrappedBytes = Buffer.byteLength(JSON.stringify({
  runId: 'r'.repeat(300),
  error: bounded,
}));
assert.equal(bytes, 256);
assert.equal(bounded.truncated, true);
assert.equal(restoredBytes, 399);
assert.equal(wrappedBytes, 577);

const shared = new Error('shared');
shared.stack = 'Error: shared';
const aggregate = new AggregateError([shared, shared], 'many');
aggregate.stack = 'AggregateError: many';
const array = makeCorjArray(aggregate);
assert.equal(array.length, 2);
assert.deepEqual(array[0]!.child_ids, ['0', '0']);

console.log(JSON.stringify({
  nativeSummary,
  invalidDetailsAccepted: invalid.message,
  shallowFreeze: Object.isFrozen(err.details),
  nestedMutable: true,
  tagRuntimeWritable: descriptor.writable,
  rawJsonKeys: Object.keys(raw),
  corjAsJsonKeys: Object.keys(restored.as_json as any),
  corjRootKeys: Object.keys(corj),
  preservedCausePath: restored.children?.[0]?.path,
  corjLeaksDiagnosticToken: true,
  appDiagnosticRedactsToken: true,
  appDiagnosticOmitsStack: true,
  corjLosesRendererFailure: true,
  corjGetterCalls: getterCalls,
  corjCallbackContexts: contexts,
  boundedBytes: bytes,
  boundedRestoredBytes: restoredBytes,
  wrappedBytes,
  repeatedCauseNodeCount: array.length,
  repeatedCauseLinks: array[0]!.child_ids,
}, null, 2));
