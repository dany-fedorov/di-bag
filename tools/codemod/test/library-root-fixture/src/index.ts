// A stand-in for a library checked out next to its callers: the declarations live under src/, not in node_modules.
export interface StartupOptions { readonly signal?: AbortSignal; readonly timeoutMs?: number }
export interface CloseOptions { readonly signal?: AbortSignal; readonly timeoutMs?: number }

export class Bag {
  async close(options?: CloseOptions): Promise<void> { void options; }
}

export class Builder {
  build(): Bag { return new Bag(); }
  async buildAndStart(keys: readonly string[], options?: StartupOptions): Promise<Bag> { void keys; void options; return this.build(); }
}

// The library's own calls are never rewritten; its authors change them by hand.
export const started = new Builder().buildAndStart(['inside']);
