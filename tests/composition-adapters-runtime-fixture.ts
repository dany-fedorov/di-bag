/** Assertions executed against both physical emitter archives and module formats. */
export const compositionAdapterRuntimeAssertions = `
  {
    const assertAdapter = (condition, message) => { if (!condition) throw new Error(message); };
    const portKey = Symbol('port');
    const pendingKey = Symbol('pending');
    const portToken = DiBag.createToken(portKey).forService();
    const pendingToken = DiBag.createToken(pendingKey).forService();
    let created = 0;
    let disposed = 0;
    class Client {
      #port;
      constructor(port) { created++; this.#port = port; this.constructedAs = new.target; }
      read() { return this.#port; }
    }
    const pendingValue = Promise.resolve(7);
    const model = { factor: 2, multiply(value) { return this.factor * value; } };
    const classProvider = DiBag.providerWithLifetime({ provider: DiBag.providerWithDisposal({ provider: DiBag.createProviderFromClass({ dependencies: [portToken], serviceClass: Client }), disposeService: value => {
        assertAdapter(value instanceof Client && value.read() === 8080, 'wrong constructor disposer value');
        disposed++;
      } }), lifetime: 'singleton:one-per-container-tree' });
    const functionProvider = DiBag.createProviderFromFunction({ dependencies: [portToken], factoryFunction: model.multiply.bind(model) });
    const rawProvider = DiBag.providerWithDisposal({ provider: DiBag.createProviderFromFunction({ dependencies: [pendingToken], factoryFunction: value => value, factoryReturnKind: 'uninspected' }), disposeService: value => { assertAdapter(value === pendingValue, 'raw function acquisition changed'); disposed++; },  });
    assertAdapter(created === 0, 'adapter eagerly constructed service');
    const adapterRoot = DiBag.createBuilder().withTokenService(portToken, DiBag.providerWithLifetime({ provider: () => 8080, lifetime: 'singleton:one-per-container-tree' })).withTokenService(pendingToken, () => pendingValue).withServices({ client: classProvider, multiply: functionProvider, raw: rawProvider }).buildContainer();
    const adapterChild = adapterRoot.createChildContainer({ sharedParentServiceKeys: ['raw'] });
    const client = adapterChild.resolve('client');
    assertAdapter(client instanceof Client && client.constructedAs === Client && client.read() === 8080, 'class semantics changed');
    assertAdapter(adapterRoot.resolve('client') === client && created === 1, 'class root identity changed');
    assertAdapter(adapterChild.resolve('multiply') === 16160, 'positional bound function failed');
    assertAdapter(adapterChild.resolve('raw') === pendingValue, 'function implicitly awaited dependency');
    await adapterChild.close();
    assertAdapter(disposed === 0, 'child disposed shared adapter acquisition');
    await adapterRoot.close();
    assertAdapter(disposed === 2, 'adapter ownership duplicated or lost');
  }
`;
