import { DiBag, type LifecycleEvent, type ObserverFailure } from '../src/node';

async function main() {
  const events: LifecycleEvent[] = [];
  const observerFailures: ObserverFailure[] = [];
  let deliveredClose!: () => void;
  const delivered = new Promise<void>((resolve) => {
    deliveredClose = resolve;
  });
  const observed = DiBag.withConfiguration({
    observers: [
      {
        onEvent(event) {
          events.push(event);
          if (event.kind === 'scope-closed') deliveredClose();
        },
        onError(failure) {
          observerFailures.push(failure);
        },
      },
    ],
  });
  let disposals = 0;
  const bag = observed
    .createBuilder()
    .register({
      connection: observed.withMetadata(
        observed.withDisposal(
          observed.fromFactory(() => ({ name: 'reporting' }), { acquisitionMode: 'raw' }),
          () => {
            disposals++;
          },
        ),
        { static: { 'app:owner': { team: 'platform' } } },
      ),
    })
    .alias('reports', 'connection')
    .build();

  try {
    if (bag.resolve('reports') !== bag.resolve('connection')) {
      throw new Error('An observed alias must retain its canonical service');
    }
  } finally {
    await bag.close();
  }
  // The application owns completion of its telemetry callback work.
  await delivered;
  if (
    disposals !== 1 ||
    observerFailures.length !== 0 ||
    events.filter((event) => event.kind === 'acquisition-started').length !== 1
  ) {
    throw new Error('Observation changed ownership or reported a delivery failure');
  }
  console.log(events.map((event) => event.kind).join(' -> '));
}

void main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
