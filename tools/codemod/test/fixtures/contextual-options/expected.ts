import { type CloseOptions, type EnsureServicesReadyOptions } from 'di-bag';

declare function start(options?: EnsureServicesReadyOptions): void;
declare function close(options?: CloseOptions): void;
declare const signal: AbortSignal;

start({ abortSignal: signal, totalTimeoutMs: 5_000 });
close({ abortSignal: signal, waitTimeoutMs: 1_000 });
