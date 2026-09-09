import { mkdtempSync, readFileSync, readdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { compileNative, resolveNative } from './native-compiler.ts';
import { matchNativeDiagnosticMarkers } from '../tests/native-diagnostic-markers.ts';

async function main() {
  const root = process.cwd();
  const directory = mkdtempSync(join(tmpdir(), 'di-bag-native-source-'));
  try {
    const compiler = await resolveNative(root);
    const fixtureRoot = resolve(root, 'tests/types');
    const files = readdirSync(fixtureRoot, { recursive: true }).map(String).filter(file => file.endsWith('.ts')).sort();
    let expected = 0, matched = 0, unexpected = 0, failures = 0;
    let primaryExpected = 0, primaryMatched = 0, supplementalExpected = 0, supplementalMatched = 0;
    let knownNativeRejections = 0;
    console.log(JSON.stringify({ compiler, files: files.length }));
    for (const fixture of files) {
      const file = resolve(fixtureRoot, fixture);
      const result = await compileNative(compiler, directory, [file], { skipLibCheck: true });
      const markers = matchNativeDiagnosticMarkers(readFileSync(file, 'utf8'), file, result.diagnostics);
      expected += markers.expected; matched += markers.matched; unexpected += markers.unexpected.length;
      primaryExpected += markers.primaryExpected; primaryMatched += markers.primaryMatched;
      supplementalExpected += markers.supplementalExpected; supplementalMatched += markers.supplementalMatched;
      knownNativeRejections += markers.knownNativeRejections;
      const accepted = result.checked && markers.accepted;
      if (!accepted) failures++;
      console.log(JSON.stringify({ fixture, accepted, status: accepted ? markers.status : 'rejected', exitStatus: result.status, expected: markers.expected, matched: markers.matched,
        primaryExpected: markers.primaryExpected, primaryMatched: markers.primaryMatched,
        supplementalExpected: markers.supplementalExpected, supplementalMatched: markers.supplementalMatched,
        knownNativeRejections: markers.knownNativeRejections, gaps: markers.gaps, declarationErrors: markers.declarationErrors,
        unexpected: markers.unexpected, missing: markers.missing, unresolved: markers.unresolved, ...(!result.checked ? { process: result } : {}) }));
    }
    console.log(JSON.stringify({ files: files.length, status: failures ? 'rejected' : knownNativeRejections ? 'accepted-with-diagnostic-gaps' : 'accepted',
      expected, matched, primaryExpected, primaryMatched, knownNativeRejections, supplementalExpected, supplementalMatched, unexpected, failures }));
    if (failures) process.exitCode = 1;
  } finally { rmSync(directory, { recursive: true, force: true }); }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
