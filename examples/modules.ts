import { DiBag } from '../src';

const logging = DiBag.module().add({
  prefix: () => '[modules]',
  logger: ({ prefix }: { prefix: string }) => ({ log(message: string) { console.log(prefix, message); } }),
}).exports(['logger']);

const feature = DiBag.module().add({
  connection: DiBag.withDisposal(() => ({ open: true }), connection => { connection.open = false; console.log('connection closed'); }),
  service: ({ connection, logger }: { connection: { open: boolean }; logger: { log(message: string): void } }) => ({
    read() { logger.log('read'); return connection.open; },
  }),
  handler: ({ service }: { service: { read(): boolean } }) => () => service.read(),
}).exports(['service', 'handler']);

async function main() {
  const root = DiBag.begin().install(feature).install(logging).end();
  const child = root.fork(['service'], { service: () => ({ read() { return false; } }) });
  try {
    console.log('root:', root.resolve('handler')());
    console.log('child:', child.resolve('handler')());
  } finally {
    await child.close();
    await root.close();
  }
}

main().catch(error => { console.error(error); process.exitCode = 1; });
