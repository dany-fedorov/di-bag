import { DiBag, type StartupOptions } from 'di-bag';

const builder = DiBag.createBuilder().register({ value: () => 1 });
declare const signal: AbortSignal;
declare const ambient: StartupOptions;
const asserted = JSON.parse('{}') as StartupOptions;
type Structural = { signal?: AbortSignal; timeoutMs?: number };
const structural: Structural = { signal, timeoutMs: 1 };
const spreadBase: StartupOptions = { signal };
const spread = { ...spreadBase };
const trusted: StartupOptions = { signal, timeoutMs: 2 };

export function wrapper(options: StartupOptions) {
  return builder.buildAndStart(['value'], options);
}
void wrapper({ signal, timeoutMs: 3 });
void builder.buildAndStart(['value'], ambient);
void builder.buildAndStart(['value'], asserted);
void builder.buildAndStart(['value'], structural);
void builder.buildAndStart(['value'], spread);
void builder.buildAndStart(['value'], trusted);
