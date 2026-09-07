import { matchDiagnosticMarkers, parseDiagnosticExpectations, type Diagnostic } from './diagnostic-markers.ts';

// Exact observed native7.0.2 messages; these identify diagnostic-quality gaps,
// not equivalent useful primary diagnostics. Never use this table for matrices.
const fingerprints: Record<string, string> = {
  "last-token-string": "No overload matches this call.\n  The last overload gave the following error.\n    Argument of type 'string' is not assignable to parameter of type 'TokenBase & { readonly [errorBrand]: \"token must be an individually known genuine handle\"; }'.\n      Type 'string' is not assignable to type 'TokenBase'.",
  "last-token-string-union": "No overload matches this call.\n  The last overload gave the following error.\n    Argument of type 'string' is not assignable to parameter of type 'TokenBase & { readonly [errorBrand]: \"token must be an individually known genuine handle\"; }'.\n      Type 'string' is not assignable to type 'TokenBase & { readonly [errorBrand]: \"token must be an individually known genuine handle\"; }'.\n        Type 'string' is not assignable to type 'TokenBase'.",
  "last-token-open-template": "No overload matches this call.\n  The last overload gave the following error.\n    Argument of type '`a${string}`' is not assignable to parameter of type 'TokenBase & { readonly [errorBrand]: \"token must be an individually known genuine handle\"; }'.\n      Type '`a${string}`' is not assignable to type 'TokenBase'."
};

export function matchNativeDiagnosticMarkers(source: string, file: string, diagnostics: readonly Diagnostic[]) {
  const strict = matchDiagnosticMarkers(source, file, diagnostics);
  const primaries = parseDiagnosticExpectations(source).filter(marker => !marker.supplemental);
  const declarations = source.split('\n').flatMap((text, index) => text.includes('diagnostic-native-gap') ? [{ text, line: index + 1 }] : []);
  const declarationErrors: string[] = [];
  const gaps: Array<{ id: string; primary: typeof primaries[number]; diagnostic: Diagnostic }> = [];
  const declared = new Set<number>();
  for (const declaration of declarations) {
    const match = /^\s*\/\/ diagnostic-native-gap: ([a-z-]+)\s*$/.exec(declaration.text);
    const id = match?.[1];
    const primary = primaries.find(marker => declaration.line > marker.line && declaration.line < marker.end);
    if (!id || !Object.hasOwn(fingerprints, id)) { declarationErrors.push(`unknown or malformed native gap at line ${declaration.line}`); continue; }
    if (!primary || declaration.line !== primary.line + 1) { declarationErrors.push(`misplaced native gap at line ${declaration.line}`); continue; }
    if (declared.has(primary.line)) { declarationErrors.push(`duplicate native gap at line ${declaration.line}`); continue; }
    declared.add(primary.line);
    if (!strict.missing.some(marker => !marker.supplemental && marker.line === primary.line)) {
      declarationErrors.push(`stale native gap at line ${declaration.line}`); continue;
    }
    const matching = diagnostics.filter(error => error.file === file && error.line !== undefined
      && error.line >= primary.line && error.line < primary.end && error.code === 2769 && error.message === fingerprints[id]);
    if (matching.length !== 1) { declarationErrors.push(`native gap needs exactly one full fingerprint at line ${declaration.line}`); continue; }
    gaps.push({ id, primary, diagnostic: matching[0]! });
  }
  const accounted = new Set(gaps.map(gap => gap.diagnostic));
  const unexpected = strict.unexpected.filter(error => !accounted.has(error));
  const unresolved = strict.missing.filter(marker => marker.supplemental || !gaps.some(gap => gap.primary.line === marker.line));
  const accepted = declarationErrors.length === 0 && unexpected.length === 0 && unresolved.length === 0;
  return { ...strict, accepted, status: accepted ? gaps.length ? 'accepted-with-diagnostic-gaps' : 'accepted' : 'rejected',
    knownNativeRejections: gaps.length, gaps, declarationErrors, unexpected, unresolved };
}
