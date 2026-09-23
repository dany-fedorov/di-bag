import { DiBag } from '../src';

export const clockKey = Symbol('clock');
export const clock = DiBag.createToken(clockKey).forService<{ now(): number }>();

const connectionKey = Symbol('connection');
const connection = DiBag.createToken(connectionKey).forService<{
  readonly id: number;
  close(): void;
}>();
let nextConnectionId = 0;

export const feature = DiBag.createBuilder()
  .withTokenService(clock, () => ({ now: () => 42 }))
  .withTokenService(
    connection,
    DiBag.providerWithDisposal({ provider: () => ({
        id: ++nextConnectionId,
        close() {
          console.log(`connection ${this.id} closed`);
        },
      }), disposeService: (value) => value.close() }),
  )
  .withServices({
    service: DiBag.createProviderFromFunction(
      { dependencies: [clock, connection], factoryFunction: (selectedClock, selectedConnection) => ({
        read() {
          return { value: selectedClock.now(), connectionId: selectedConnection.id };
        },
      }) },
    ),
  })
  .buildModule({ exportedServiceKeys: [clock, 'service'] });

async function main() {
  const root = DiBag.createBuilder().withInstalledModules([feature]).buildContainer();
  const child = root.createIndependentContainer([clock], { [clockKey]: () => ({ now: () => 7 }) });
  try {
    console.log('root:', root.resolve('service').read());
    console.log('child:', child.resolve('service').read());
    console.log('child clock:', child.resolve(clock).now());
  } finally {
    await child.close();
    await root.close();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
