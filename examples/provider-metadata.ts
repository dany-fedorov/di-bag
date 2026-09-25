import { DiBag, type Presence } from '../src';

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

const locatedConnection = DiBag.providerWithDisposal({ provider: (): Located<typeof connection> => ({
    value: { isPresent: true, value: connection },
    origin: 'DATABASE_URL',
  }), disposeService: (result) => {
    if (result.value.isPresent) result.value.value.close();
  } });

const connectionPresence = DiBag.providerWithTransformedService({ provider: DiBag.providerWithAcquisitionMetadata({ provider: locatedConnection, describeAcquisition: (result) => ({ origin: result.origin }), callbackReceives: 'exposed-service' }), transformService: (result) => result.value, callbackReceives: 'exposed-service' });

const remoteFlag = DiBag.providerWithTransformedService({ provider: DiBag.providerWithAcquisitionMetadata({ provider: async (): Promise<Located<boolean | undefined>> => ({
      value: { isPresent: true, value: undefined },
      origin: 'feature-service',
    }), describeAcquisition: (result) => ({ origin: result.origin }), callbackReceives: 'fulfilled-value' }), transformService: (result) => result.value, callbackReceives: 'fulfilled-value' });

async function main() {
  const bag = DiBag.createBuilder().withServices({ connectionPresence, remoteFlag }).buildContainer();
  try {
    const acquired = bag.resolve('connectionPresence');
    if (acquired.isPresent) console.log('answer:', acquired.value.read());

    const flag = await bag.resolve('remoteFlag');
    console.log('flag present:', flag.isPresent);
    console.log(
      'connection frame:',
      bag.serviceSnapshot('connectionPresence').acquisitions[0]!.acquisitionMetadata[0],
    );
    console.log(
      'flag frame:',
      bag.serviceSnapshot('remoteFlag').acquisitions[0]!.acquisitionMetadata[0],
    );
  } finally {
    await bag.close();
  }
  console.log('cleanup:', events.join(', '));
}

void main();
