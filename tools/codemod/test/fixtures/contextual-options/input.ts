import { type CloseOptions, type StartupOptions } from 'di-bag';

declare function start(options?: StartupOptions): void;
declare function close(options?: CloseOptions): void;
declare const signal: AbortSignal;

start({ signal, timeoutMs: 5_000 });
close({ signal, timeoutMs: 1_000 });
