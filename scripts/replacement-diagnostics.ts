import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import {
  matchDiagnosticMarkers,
  parseDiagnosticExpectations,
  type Diagnostic,
} from '../tests/diagnostic-markers.ts';
import { compileNative, resolveNative } from './native-compiler.ts';

export const replacementDiagnosticFixtures = [
  'negative/incremental.ts',
  'negative/inline-replacement-wrong-shape.ts',
  'negative/module-hidden-private-needs.ts',
  'negative/module-narrowing.ts',
  'negative/module-rename.ts',
  'negative/provider-boundaries.ts',
  'negative/replacement-context.ts',
  'negative/replacement-wrong-shape.ts',
  'negative/required-this.ts',
  'negative/union-replace.ts',
] as const;

type ReplacementDiagnosticFixture = (typeof replacementDiagnosticFixtures)[number];
type DiagnosticInventory = {
  readonly primary: readonly string[];
  readonly supplemental: readonly { readonly code: number; readonly message: string }[];
};

export const replacementDiagnosticExpectations = {
  'negative/incremental.ts': {
    primary: [
      'provided service does not satisfy its consumer dependency', 'provided service does not satisfy its consumer dependency',
      'provided service does not satisfy its consumer dependency', 'provided service does not satisfy its consumer dependency',
      'provided service does not satisfy its consumer dependency', 'incompatible or opaque',
      'incompatible or opaque', 'incompatible or opaque', 'output is not assignable',
      'provided service does not satisfy its consumer dependency', 'required service registrations are missing', 'incompatible or opaque',
      'incompatible or opaque', 'provided service does not satisfy its consumer dependency',
      'provided service does not satisfy its consumer dependency', 'required service registrations are missing',
      'provided service does not satisfy its consumer dependency', 'incompatible or opaque',
      'provided service does not satisfy its consumer dependency',
    ],
    supplemental: [],
  },
  'negative/inline-replacement-wrong-shape.ts': { primary: ['consumer dependency'], supplemental: [] },
  'negative/module-hidden-private-needs.ts': {
    primary: ['required service registrations are missing', 'provided service does not satisfy its consumer dependency',
      'provided service does not satisfy its consumer dependency', 'provided service does not satisfy its consumer dependency'],
    supplemental: [],
  },
  'negative/module-narrowing.ts': {
    primary: ['not assignable', 'not assignable', 'missing', 'nominal', 'not assignable',
      'not assignable', 'provided service does not satisfy its consumer dependency', 'not assignable',
      'not assignable', 'not assignable', 'not assignable'],
    supplemental: [],
  },
  'negative/module-rename.ts': {
    primary: ['renameExport requires', 'renameExport requires', 'renameExport requires', 'renameExport requires',
      'renameExport requires', 'provided service does not satisfy its consumer dependency', 'provided service does not satisfy its consumer dependency'],
    supplemental: [],
  },
  'negative/provider-boundaries.ts': {
    primary: ['required service registrations are missing', 'consumer dependency', 'duplicate metadata', 'duplicate metadata',
      'finite string or unique-symbol', 'finite string or unique-symbol',
      'finite string or unique-symbol', 'finite string or unique-symbol', 'not assignable',
      'not assignable', 'not assignable', 'not assignable', 'not assignable',
      'factory dependencies must be finite', 'factory dependencies must be finite',
      'factory dependencies must be finite', 'does not exist', 'does not exist', 'read-only',
      'does not exist', 'read-only', 'not assignable', 'not assignable',
      "Property 'missing' is missing"],
    supplemental: [{ code: 2684, message: 'required service registrations are missing' }],
  },
  'negative/replacement-context.ts': {
    primary: ['provided service does not satisfy its consumer dependency', 'provided service does not satisfy its consumer dependency',
      'provided service does not satisfy its consumer dependency', 'provided service does not satisfy its consumer dependency',
      'provided service does not satisfy its consumer dependency', 'provided service does not satisfy its consumer dependency',
      'provided service does not satisfy its consumer dependency', 'provided service does not satisfy its consumer dependency',
      'factory dependencies must be finite', 'factory dependencies must be finite',
      'factory dependencies must be finite', 'factory dependencies must be finite',
      'does not satisfy the constraint', 'does not satisfy the constraint', 'required service registrations are missing',
      'required service registrations are missing', 'required service registrations are missing', 'required service registrations are missing', 'required service registrations are missing',
      'required service registrations are missing', 'provided service does not satisfy its consumer dependency',
      'provided service does not satisfy its consumer dependency', 'provided service does not satisfy its consumer dependency',
      'provided service does not satisfy its consumer dependency', 'provided service does not satisfy its consumer dependency',
      'provided service does not satisfy its consumer dependency', 'provided service does not satisfy its consumer dependency',
      'provided service does not satisfy its consumer dependency'],
    supplemental: [],
  },
  'negative/replacement-wrong-shape.ts': { primary: ['consumer dependency'], supplemental: [] },
  'negative/required-this.ts': {
    primary: ["The 'this' types of each signature are incompatible",
      "The 'this' types of each signature are incompatible",
      "The 'this' types of each signature are incompatible",
      "Type '(this: { value: number; }) => number' is not assignable to type"],
    supplemental: [],
  },
  'negative/union-replace.ts': {
    primary: ['replace requires one existing singleton string-literal key',
      'replace requires one existing singleton string-literal key',
      'replace requires one existing singleton string-literal key',
      'replace requires one existing singleton string-literal key'],
    supplemental: [],
  },
} as const satisfies Record<ReplacementDiagnosticFixture, DiagnosticInventory>;

export function evaluateReplacementDiagnostics(
  source: string,
  file: string,
  diagnostics: readonly Diagnostic[],
  checked: boolean,
  expectedInventory?: DiagnosticInventory,
) {
  const result = matchDiagnosticMarkers(source, file, diagnostics);
  const markers = parseDiagnosticExpectations(source);
  const actualPrimary = markers.filter(marker => !marker.supplemental).map(marker => marker.message);
  const actualSupplemental = markers.filter(marker => marker.supplemental).map(marker => ({
    code: marker.code!,
    message: marker.message,
  }));
  const expected = expectedInventory ?? {
    primary: actualPrimary,
    supplemental: actualSupplemental,
  };
  const primaryAccepted = actualPrimary.length === expected.primary.length
    && actualPrimary.every((message, index) => message === expected.primary[index]);
  const supplementalAccepted = actualSupplemental.length === expected.supplemental.length
    && actualSupplemental.every((marker, index) => marker.code === expected.supplemental[index]?.code
      && marker.message === expected.supplemental[index]?.message);
  const inventory = {
    accepted: primaryAccepted && supplementalAccepted,
    primaryExpected: expected.primary.length,
    primaryActual: result.primaryExpected,
    supplementalExpected: expected.supplemental.length,
    supplementalActual: result.supplementalExpected,
  };
  return {
    ...result,
    inventory,
    accepted: checked && inventory.accepted
      && result.missing.length === 0 && result.unexpected.length === 0,
  };
}

type ReplacementEvaluation = ReturnType<typeof evaluateReplacementDiagnostics>;
type AuditRow = ReplacementEvaluation & {
  fixture: ReplacementDiagnosticFixture;
  checked: boolean;
  process?: Awaited<ReturnType<typeof compileNative>>;
};

export async function auditReplacementDiagnostics(root: string) {
  const directory = mkdtempSync(join(tmpdir(), 'di-bag-replacement-audit-'));
  const rows: AuditRow[] = [];

  try {
    const compiler = await resolveNative(root);
    const fixtureRoot = resolve(root, 'tests/types');

    for (const fixture of replacementDiagnosticFixtures) {
      const file = resolve(fixtureRoot, fixture);
      const source = readFileSync(file, 'utf8');
      const result = await compileNative(compiler, directory, [file], { skipLibCheck: true });
      const evaluation = evaluateReplacementDiagnostics(
        source,
        file,
        result.diagnostics,
        result.checked,
        replacementDiagnosticExpectations[fixture],
      );
      rows.push({
        fixture,
        checked: result.checked,
        ...evaluation,
        ...(!result.checked ? { process: result } : {}),
      });
    }

    const primaryExpected = replacementDiagnosticFixtures.reduce(
      (total, fixture) => total + replacementDiagnosticExpectations[fixture].primary.length,
      0,
    );
    const primaryMatched = rows.reduce((total, row) => total + row.primaryMatched, 0);
    const supplementalExpected = replacementDiagnosticFixtures.reduce(
      (total, fixture) => total + replacementDiagnosticExpectations[fixture].supplemental.length,
      0,
    );
    const supplementalMatched = rows.reduce((total, row) => total + row.supplementalMatched, 0);
    const missingPrimary = Math.max(0, primaryExpected - primaryMatched);
    const unexpected = rows.reduce((total, row) => total + row.unexpected.length, 0);

    return {
      compiler,
      rows,
      accepted: rows.every(row => row.accepted),
      missingPrimary,
      primaryExpected,
      primaryMatched,
      supplementalExpected,
      supplementalMatched,
      unexpected,
    };
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
}
