import { Builder } from '../src/index.js';

export async function main(signal: AbortSignal) {
  const bag = await new Builder().buildAndStart(['db'], { signal, timeoutMs: 5 });
  await bag.close({ timeoutMs: 10 });
}
