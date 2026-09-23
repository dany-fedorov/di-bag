import assert from 'node:assert/strict';
import { DiBag } from '../src';

class Client {
  constructor(private readonly port: number) {}
  address() {
    return `localhost:${this.port}`;
  }
}
function endpoint(client: Client, path: string) {
  return `http://${client.address()}/${path}`;
}

class Reporter {
  constructor(
    private readonly getClient: () => Client,
    private readonly label: string | undefined,
  ) {}
  describe() {
    return `${this.label ?? 'service'} at ${this.getClient().address()}`;
  }
}

async function main() {
  const portKey = Symbol('port');
  const clientKey = Symbol('client');
  const pathKey = Symbol('path');
  const labelKey = Symbol('label');
  const clientAliasKey = Symbol('client alias');
  const port = DiBag.createToken(portKey).forService<number>();
  const client = DiBag.createToken(clientKey).forService<Client>();
  const path = DiBag.createToken(pathKey).forService<string>();
  const label = DiBag.createToken(labelKey).forService<string>();
  const clientAlias = DiBag.createToken(clientAliasKey).forService<Client>();
  const bag = DiBag.createBuilder()
    .withTokenService(port, () => 8080)
    .withTokenService(client, DiBag.createProviderFromClass({ dependencies: [port], serviceClass: Client }))
    .withServiceAlias({ aliasKey: clientAlias, targetServiceKey: client })
    .withTokenService(path, () => 'health')
    .withServices({
      endpoint: DiBag.createProviderFromFunction({ dependencies: [client, path], factoryFunction: endpoint }),
      reporter: DiBag.createProviderFromClass(
        { dependencies: [DiBag.lazy(clientAlias), DiBag.optional(label)], serviceClass: Reporter },
      ),
    })
    .withServiceAlias({ aliasKey: 'report', targetServiceKey: 'reporter' })
    .buildContainer();
  const url = bag.resolve('endpoint');
  assert.equal(url, 'http://localhost:8080/health');
  assert.equal(bag.resolve('reporter').describe(), 'service at localhost:8080');
  assert.equal(bag.resolve('report'), bag.resolve('reporter'));
  assert.equal(bag.resolve(clientAlias), bag.resolve(client));
  console.log(url);
  await bag.close();
}

void main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
