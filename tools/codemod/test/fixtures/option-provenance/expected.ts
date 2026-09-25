import { DiBag, type EnsureServicesReadyOptions } from 'di-bag';

const builder = DiBag.createBuilder().withServices({ value: () => 1 });
declare const signal: AbortSignal;
declare const ambient: EnsureServicesReadyOptions;
const asserted = JSON.parse('{}') as EnsureServicesReadyOptions;
type Structural = { signal?: AbortSignal; timeoutMs?: number };
const structural: Structural = { signal, timeoutMs: 1 };
const spreadBase: EnsureServicesReadyOptions = { abortSignal: signal };
const spread = { ...spreadBase };
const trusted: EnsureServicesReadyOptions = { abortSignal: signal, totalTimeoutMs: 2 };

export function wrapper(options: EnsureServicesReadyOptions) {
  return builder.buildContainer().ensureServicesReady(['value'], options);
}
void wrapper({ abortSignal: signal, totalTimeoutMs: 3 });
void builder.buildContainer().ensureServicesReady(['value'], ambient);
void builder.buildContainer().ensureServicesReady(['value'], asserted);
void builder.buildContainer().ensureServicesReady(['value'], structural);
void builder.buildContainer().ensureServicesReady(['value'], spread);
void builder.buildContainer().ensureServicesReady(['value'], trusted);
