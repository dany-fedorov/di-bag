from pathlib import Path
import hashlib,json

out=Path('/tmp/di-bag-classic-depth-probe')
source=Path('/tmp/di-bag-performance-integration/node_modules/@typescript/old/lib/typescript.js').read_text()
patches={
 '  function checkCallExpression(node, checkMode) {':'\n    globalThis.__diCallNode = node;',
 '  function getMinArgumentCount(signature, flags) {':'\n    globalThis.__diMinSignature = signature;',
 '  function getTypeOfInstantiatedSymbol(symbol) {':'\n    globalThis.__diInstantiatedSymbol = symbol;',
 '  function instantiateType(type, mapper) {':'\n    globalThis.__diInstantiation = type; globalThis.__diMapper = mapper;',
}
modified=source
for anchor,insertion in patches.items():
 assert modified.count(anchor)==1
 modified=modified.replace(anchor,anchor+insertion)
(out/'instrumented-typescript.cjs').write_text(modified)
(out/'instrumentation-identity.json').write_text(json.dumps({'compiler':'classic6.0.3','sourceSha256':hashlib.sha256(source.encode()).hexdigest(),'instrumentedSha256':hashlib.sha256(modified.encode()).hexdigest(),'insertions':patches,'purpose':'Diagnostic reference capture only; original acceptance results use the unmodified compiler. No stack/heap/deadline increases and no warmups.'},indent=2)+'\n')
