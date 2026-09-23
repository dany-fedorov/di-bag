import { DiBag } from '../src';

type Step = (text: string) => string;
async function main() {
  const stepKey = Symbol('text pipeline step');
  const steps = DiBag.createToken(stepKey).forCollectionOf<Step>();

  // An exportless module can contribute a service using a private helper.
  const prefixFeature = DiBag.createBuilder()
    .withServices({ prefix: () => 'Hello, ' })
    .withCollectionContribution({
      collectionToken: steps,
      provider: ({ prefix }: { prefix: string }): Step =>
        (text) =>
          prefix + text,
    })
    .buildModule({ exportedServiceKeys: [] });

  const bag = DiBag.createBuilder()
    .withCollectionContribution({ collectionToken: steps, provider: (): Step => (text) => text.trim() })
    .withInstalledModules([prefixFeature])
    .withCollectionContribution({ collectionToken: steps, provider: (): Step => (text) => text + '!' })
    .withServices({
      pipeline: DiBag.createProviderFromFunction(
        { dependencies: [steps], factoryFunction: (operations) => (text: string) =>
          operations.reduce((value, step) => step(value), text) },
      ),
    })
    .buildContainer();

  try {
    const result = bag.resolve('pipeline')('  DI  ');
    if (result !== 'Hello, DI!') throw new Error(`Unexpected pipeline result: ${result}`);
    const operations = bag.resolveCollection(steps);
    if (operations.length !== 3 || !Object.isFrozen(operations)) {
      throw new Error('The pipeline must expose three ordered, immutable entries');
    }
    console.log(result);
  } finally {
    await bag.close();
  }
}

void main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
