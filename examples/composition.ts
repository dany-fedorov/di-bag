import assert from 'node:assert/strict';
import { DiBag } from '../src/node';

class Client {
  constructor(private readonly port: number) {}
  address() { return `localhost:${this.port}`; }
}
function endpoint(client: Client, path: string) {
  return `http://${client.address()}/${path}`;
}

class Reporter {
  constructor(
    private readonly getClient: () => Client,
    private readonly label: string | undefined,
  ) {}
  describe() { return `${this.label ?? 'service'} at ${this.getClient().address()}`; }
}

async function main() {
  const portKey = Symbol('port');
  const clientKey = Symbol('client');
  const pathKey = Symbol('path');
  const labelKey = Symbol('label');
  const port = DiBag.token(portKey).of<number>();
  const client = DiBag.token(clientKey).of<Client>();
  const path = DiBag.token(pathKey).of<string>();
  const label = DiBag.token(labelKey).of<string>();
  const bag = DiBag.begin()
    .bind(port, () => 8080)
    .bind(client, DiBag.fromClass([port], Client))
    .bind(path, () => 'health')
    .add({
      endpoint: DiBag.fromFunction([client, path], endpoint),
      reporter: DiBag.fromClass([DiBag.lazy(client), DiBag.optional(label)], Reporter),
    })
    .end();
  const url = bag.resolve('endpoint');
  assert.equal(url, 'http://localhost:8080/health');
  assert.equal(bag.resolve('reporter').describe(), 'service at localhost:8080');
  console.log(url);
  await bag.close();
}

void main().catch(error => { console.error(error); process.exitCode = 1; });
