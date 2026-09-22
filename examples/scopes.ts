import assert from 'node:assert/strict';
import { DiBag } from '../src';

async function main() {
  const released: string[] = [];
  const root = await DiBag.createBuilder()
    .withServices({
      config: DiBag.withLifetime(() => ({ region: 'eu' }), 'root'),
      client: DiBag.withLifetime(
        DiBag.withDisposal(
          ({ config }: { config: { region: string } }) => ({ region: config.region }),
          () => {
            released.push('client');
          },
        ),
        'root',
      ),
      session: DiBag.withDisposal(
        ({ config }: { config: { region: string } }) => ({ region: config.region }),
        () => {
          released.push('session');
        },
      ),
    })
    .buildContainer()
    .ensureServicesReady(['client']);

  const child = root.createChildContainer(
    ['config'],
    {
      config: () => ({ region: 'us' }),
    },
    { sharedParentServiceKeys: ['session'] },
  );
  assert.equal(child.resolve('config').region, 'us');
  assert.equal(child.resolve('client').region, 'eu');
  assert.equal(child.resolve('session').region, 'eu');
  assert.equal(child.resolve('session'), root.resolve('session'));

  const grandchild = child.createChildContainer({ sharedParentServiceKeys: ['session'] });
  assert.equal(grandchild.resolve('session'), root.resolve('session'));
  await child.close();
  assert.deepEqual(released, []);
  await root.close();
  assert.deepEqual(released, ['session', 'client']);
  console.log('Selected scopes preserve parent dependencies and ownership.');
}

void main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
