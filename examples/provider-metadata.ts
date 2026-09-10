import { DiBag, type Presence } from '../src/node';

type Located<T> = {
  readonly value: Presence<T>;
  readonly origin: string;
};

const events: string[] = [];
const connection = {
  read() {
    return 42;
  },
  close() {
    events.push('connection');
  },
};

const locatedConnection = DiBag.withDisposal(
  (): Located<typeof connection> => ({
    value: { present: true, value: connection },
    origin: 'DATABASE_URL',
  }),
  (result) => {
    if (result.value.present) result.value.value.close();
  },
);

const connectionPresence = DiBag.transformService(
  DiBag.withMetadata(locatedConnection, {
    dynamic: { mode: 'direct', describe: (result) => ({ origin: result.origin }) },
  }),
  { mode: 'direct', transform: (result) => result.value },
);

const remoteFlag = DiBag.transformService(
  DiBag.withMetadata(
    async (): Promise<Located<boolean | undefined>> => ({
      value: { present: true, value: undefined },
      origin: 'feature-service',
    }),
    { dynamic: { mode: 'awaited', describe: (result) => ({ origin: result.origin }) } },
  ),
  { mode: 'awaited', transform: (result) => result.value },
);

async function main() {
  const bag = DiBag.createBuilder().register({ connectionPresence, remoteFlag }).build();
  try {
    const acquired = bag.resolve('connectionPresence');
    if (acquired.present) console.log('answer:', acquired.value.read());

    const flag = await bag.resolve('remoteFlag');
    console.log('flag present:', flag.present);
    console.log(
      'connection frame:',
      bag.inspect('connectionPresence').acquisitions[0]!.acquisitionMetadata[0],
    );
    console.log(
      'flag frame:',
      bag.inspect('remoteFlag').acquisitions[0]!.acquisitionMetadata[0],
    );
  } finally {
    await bag.close();
  }
  console.log('cleanup:', events.join(', '));
}

void main();
