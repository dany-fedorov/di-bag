import { DiBag, type Presence } from '../src';
import { fromSasBox } from '../src/sas-box';
import { fromValBoxAsync } from '../src/val-box';

// Structural protocols keep this example runnable without installing either box.
// Real SasBox instances and ValBox.snapshot() implement these same boundaries.
const events: string[] = [];
const payload = { read() { return 42; }, close() { events.push('payload owner'); } };
const rawBox = {
  snapshot() {
    return { value: { present: true, value: payload } satisfies Presence<typeof payload>,
      metadata: { present: true, value: { owner: 'application' } } satisfies Presence<{ owner: string }>, alias: 'database' };
  },
  close() { events.push('raw box'); },
};

async function main() {
  const source = fromSasBox(() => ({ sync: undefined, async: async () => rawBox }), { mode: 'sync-first' });
  // Own the acquired box. Unboxing borrows its payload; close() method names
  // alone never grant disposal authority to the bag.
  const service = fromValBoxAsync(DiBag.withDisposal(source, box => box.close()));
  const bag = DiBag.begin().add({ service }).end();
  try {
    const value = await bag.resolve('service');
    console.log('answer:', value.read());
    console.log('frame:', bag.inspect('service').acquisitions[0]!.metadata[0]);
  } finally {
    await bag.close();
    payload.close(); // The application created and owns this shared payload.
  }
  console.log('cleanup:', events.join(', '));
}

void main();
