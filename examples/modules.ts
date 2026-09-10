import { DiBag } from '../src/node';

const logging = DiBag.createBuilder()
  .register({
    prefix: () => '[modules]',
    logger: ({ prefix }: { prefix: string }) => ({
      log(message: string) {
        console.log(prefix, message);
      },
    }),
  })
  .buildModule(['logger']);

const feature = DiBag.createBuilder()
  .register({
    connection: DiBag.withDisposal(
      () => ({ open: true }),
      (connection) => {
        connection.open = false;
        console.log('connection closed');
      },
    ),
    service: ({
      connection,
      logger,
    }: {
      connection: { open: boolean };
      logger: { log(message: string): void };
    }) => ({
      read() {
        logger.log('read');
        return connection.open;
      },
    }),
    handler:
      ({ service }: { service: { read(): boolean } }) =>
      () =>
        service.read(),
  })
  .buildModule(['service', 'handler']);

async function main() {
  const root = DiBag.createBuilder()
    .installModule(feature)
    .installModule(logging)
    .build();
  const child = root.fork(['service'], {
    service: () => ({
      read() {
        return false;
      },
    }),
  });
  try {
    console.log('root:', root.resolve('handler')());
    console.log('child:', child.resolve('handler')());
  } finally {
    await child.close();
    await root.close();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
