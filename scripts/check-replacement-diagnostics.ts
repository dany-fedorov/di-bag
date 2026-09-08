import { auditReplacementDiagnostics } from './replacement-diagnostics.ts';

auditReplacementDiagnostics(process.cwd()).then(result => {
  console.log(JSON.stringify(result));
  if (!result.accepted) process.exitCode = 1;
}).catch(error => {
  console.error(error);
  process.exitCode = 1;
});
