import assert from 'node:assert/strict';
import { DiBag } from '../src/node';

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
  const port = DiBag.token(portKey).of<number>();
  const client = DiBag.token(clientKey).of<Client>();
  const path = DiBag.token(pathKey).of<string>();
  const label = DiBag.token(labelKey).of<string>();
  const clientAlias = DiBag.token(clientAliasKey).of<Client>();
  const bag = DiBag.createBuilder()
    .register(port, () => 8080)
    .register(client, DiBag.fromClass([port], Client))
    .alias(clientAlias, client)
    .register(path, () => 'health')
    .register({
      endpoint: DiBag.fromFunction([client, path], endpoint),
      reporter: DiBag.fromClass(
        [DiBag.lazy(clientAlias), DiBag.optional(label)],
        Reporter,
      ),
    })
    .alias('report', 'reporter')
    .build();
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
