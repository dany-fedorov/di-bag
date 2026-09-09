export type Diagnostic = { file?: string | undefined; line?: number | undefined; column?: number | undefined; code: number; message: string };

export function parseDiagnosticExpectations(source: string) {
  const primaries = [...source.matchAll(/\/\/ diagnostic: (.+)/g)].map(marker => ({
    line: source.slice(0, marker.index).split('\n').length, message: marker[1]!,
  }));
  return primaries.flatMap((primary, index) => {
    const end = primaries[index + 1]?.line ?? Infinity;
    const supplemental = source.split('\n').slice(primary.line, end - 1).flatMap(line => {
      const match = /^\s*\/\/ diagnostic-also: TS(\d+) (.+)$/.exec(line);
      return match ? [{ ...primary, end, code: Number(match[1]), message: match[2]!, supplemental: true }] : [];
    });
    return [{ ...primary, end, code: undefined, supplemental: false }, ...supplemental];
  });
}

export function matchDiagnosticMarkers(source: string, file: string, diagnostics: readonly Diagnostic[]) {
  const expectations = parseDiagnosticExpectations(source);
  const primaryExpected = expectations.filter(marker => !marker.supplemental).length;
  const matches = expectations.map(marker => diagnostics.filter(error => error.file === file
    && error.line !== undefined && error.line >= marker.line && error.line < marker.end
    && error.code !== 2589 && (marker.code === undefined || marker.code === error.code) && error.message.includes(marker.message)));
  const matchedDiagnostics = new Set(matches.flat());
  const countMatched = (supplemental: boolean) => expectations.filter((marker, index) => marker.supplemental === supplemental && matches[index]!.length > 0).length;
  return { expected: expectations.length, matched: matches.filter(errors => errors.length > 0).length,
    primaryExpected, primaryMatched: countMatched(false),
    supplementalExpected: expectations.length - primaryExpected, supplementalMatched: countMatched(true),
    unexpected: diagnostics.filter(error => !matchedDiagnostics.has(error)),
    missing: expectations.filter((_marker, index) => matches[index]!.length === 0) };
}
