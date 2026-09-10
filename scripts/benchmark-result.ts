export type MatrixCase = { count: number; form: 'bulk' | 'chained' | 'grouped' | 'replacement' | 'bindings' | 'modules'; scenario: 'valid' | 'missing' | 'wrong-shape' | 'missing-final-token' | 'mismatched-invariant-service' };
export type WorkerEvidence = { status: number | null; signal: string | null; error?: string; stdout: string; stderr: string };
export type Diagnostic = { file?: string | undefined; line?: number | undefined; column?: number | undefined; code: number; message: string };

export function acceptDiagnostics(diagnostics: readonly Diagnostic[], item: MatrixCase, expectedPath: string, boundaryLine: unknown): boolean {
  const intended = item.scenario === 'missing' || item.scenario === 'missing-final-token' ? 'required service registrations are missing'
    : item.form === 'bindings' ? 'token dependency has an incompatible or opaque contract' : 'provided service does not satisfy its consumer dependency';
  return diagnostics.every(error => error.file === expectedPath)
    && (item.scenario === 'valid' ? diagnostics.length === 0
      : !diagnostics.some(error => error.code === 2589)
        && typeof boundaryLine === 'number' && Number.isInteger(boundaryLine) && boundaryLine > 0
        && diagnostics.filter(error => error.line === boundaryLine && error.message.includes(intended)).length === 1);
}

export function evaluateWorker(item: MatrixCase, child: WorkerEvidence, expectedPath: string): Record<string, unknown> {
  let result: Record<string, unknown> = {};
  let parseError: string | undefined;
  try {
    const parsed: unknown = JSON.parse(child.stdout);
    if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) throw new Error('worker JSON is not an object');
    result = parsed as Record<string, unknown>;
  } catch (error) { parseError = String(error); }
  const completed = child.status === 0 && child.signal === null && child.error === undefined && child.stderr === '' && child.stdout.trim() !== '';
  const identityMatches = result.count === item.count && result.form === item.form && result.scenario === item.scenario;
  const diagnostics = result.diagnostics;
  const hasDiagnostics = Array.isArray(diagnostics) && diagnostics.every(error =>
    typeof error === 'object' && error !== null && Number.isInteger(error.code) && error.code > 0
      && typeof error.message === 'string'
      && (error.file === undefined || typeof error.file === 'string')
      && (error.line === undefined || Number.isInteger(error.line) && error.line > 0));
  const described: Diagnostic[] = hasDiagnostics ? diagnostics : [];
  const accepted = completed && parseError === undefined && identityMatches && hasDiagnostics
    && acceptDiagnostics(described, item, expectedPath, result.boundaryLine);
  const failureReason = accepted ? undefined : !completed ? 'worker did not complete cleanly'
    : parseError ? 'worker returned malformed JSON' : !identityMatches ? 'worker case identity mismatch'
      : !hasDiagnostics ? 'worker diagnostics are missing or malformed'
        : item.scenario === 'valid' ? `valid case returned ${described.length} diagnostics`
          : described.some(error => error.code === 2589) ? 'compiler returned TS2589'
          : described.some(error => error.file !== expectedPath) ? 'diagnostic came from another file'
            : 'intended diagnostic did not occur exactly once at the generated boundary';
  return { ...result, ...item, ...child, accepted, ...(parseError ? { parseError } : {}), ...(failureReason ? { failureReason } : {}) };
}
