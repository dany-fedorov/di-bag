import { DiBag } from '../src';

const logging = DiBag.createBuilder()
  .withServices({
    prefix: () => '[modules]',
    logger: ({ prefix }: { prefix: string }) => ({
      log(message: string) {
        console.log(prefix, message);
      },
    }),
  })
  .buildModule({ exportedServiceKeys: ['logger'] });

const feature = DiBag.createBuilder()
  .withServices({
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
  .buildModule({ exportedServiceKeys: ['service', 'handler'] });

async function main() {
  const root = DiBag.createBuilder()
    .withInstalledModules([feature])
    .withInstalledModules([logging])
    .buildContainer();
  const child = root.createIndependentContainer(['service'], {
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
