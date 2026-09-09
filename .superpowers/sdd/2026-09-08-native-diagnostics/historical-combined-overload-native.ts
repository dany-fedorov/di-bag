import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve, join } from 'node:path';
import { compileNative, resolveNative } from '../../../scripts/native-compiler.ts';
import { matchDiagnosticMarkers } from '../../../tests/diagnostic-markers.ts';

const root = process.cwd();
const directory = mkdtempSync(join(tmpdir(), 'di-bag-historical-overload-native-'));
try {
  const compiler = await resolveNative(root);
  for (const fixture of [
    'tests/types/replacement-reflection.ts',
    'tests/types/negative/replacement-reflection.ts',
  ]) {
    const file = resolve(root, fixture);
    const result = await compileNative(compiler, directory, [file], { skipLibCheck: true });
    const markers = matchDiagnosticMarkers(readFileSync(file, 'utf8'), file, result.diagnostics);
    console.log(JSON.stringify({
      fixture,
      checked: result.checked,
      status: result.status,
      diagnostics: result.diagnostics,
      expected: markers.expected,
      matched: markers.matched,
      missing: markers.missing,
      unexpected: markers.unexpected,
    }));
  }
} finally {
  rmSync(directory, { recursive: true, force: true });
}
