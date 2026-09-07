import { DiBag } from '../src/node';

export const clockKey = Symbol('clock');
export const clock = DiBag.token(clockKey).of<{ now(): number }>();

const connectionKey = Symbol('connection');
const connection = DiBag.token(connectionKey).of<{ readonly id: number; close(): void }>();
let nextConnectionId = 0;

export const feature = DiBag.module()
  .bind(clock, () => ({ now: () => 42 }))
  .bind(connection, DiBag.withDisposal(
    () => ({ id: ++nextConnectionId, close() { console.log(`connection ${this.id} closed`); } }),
    value => value.close(),
  ))
  .add({
    service: DiBag.fromTokens([clock, connection], (selectedClock, selectedConnection) => ({
      read() { return { value: selectedClock.now(), connectionId: selectedConnection.id }; },
    })),
  })
  .exports([clock, 'service']);

async function main() {
  const root = DiBag.begin().install(feature).end();
  const child = root.fork([clock], { [clockKey]: () => ({ now: () => 7 }) });
  try {
    console.log('root:', root.resolve('service').read());
    console.log('child:', child.resolve('service').read());
    console.log('child clock:', child.resolve(clock).now());
  } finally {
    await child.close();
    await root.close();
  }
}

main().catch(error => { console.error(error); process.exitCode = 1; });
