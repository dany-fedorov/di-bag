import { DiBag } from '../src/node';

interface Handler {
  handle(text: string): string;
}

async function main() {
  const handlerKey = Symbol('handler');
  const handler = DiBag.token(handlerKey).of<Handler>();

  // An application selects this descriptor from its own configuration/import path.
  const selected: unknown = {
    apiVersion: 1,
    create: () => ({ handle: (text: string) => text.toUpperCase() }),
    dispose(acquired: Handler) {
      if (acquired.handle('ok') !== 'OK') throw new Error('Plugin ownership changed');
      disposals++;
    },
  };
  let disposals = 0;
  const provider = DiBag.fromPlugin([], selected, {
    acquisitionMode: 'raw',
    validate: (value: unknown): value is Handler =>
      typeof value === 'object' &&
      value !== null &&
      'handle' in value &&
      typeof value.handle === 'function',
  });
  const feature = DiBag.createModuleBuilder()
    .register(handler, provider)
    .buildModule([handler]);
  const bag = DiBag.createBuilder().installModule(feature).build();

  try {
    const result = bag.resolve(handler).handle('hello');
    if (result !== 'HELLO') throw new Error(`Unexpected plugin result: ${result}`);
    console.log(result);
  } finally {
    await bag.close();
  }
  if (disposals !== 1) throw new Error('Plugin cleanup must run exactly once');
}

void main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
