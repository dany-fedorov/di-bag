import { DiBag } from '../src/node';

type Step = (text: string) => string;
async function main() {
  const stepKey = Symbol('text pipeline step');
  const steps = DiBag.token(stepKey).of<Step>();

  // An exportless module can contribute a service using a private helper.
  const prefixFeature = DiBag.module()
    .add({ prefix: () => 'Hello, ' })
    .contribute(steps, ({ prefix }: { prefix: string }): Step => text => prefix + text)
    .exports([]);

  const bag = DiBag.begin()
    .contribute(steps, (): Step => text => text.trim())
    .install(prefixFeature)
    .contribute(steps, (): Step => text => text + '!')
    .add({
      pipeline: DiBag.fromFunction([DiBag.all(steps)], operations =>
        (text: string) => operations.reduce((value, step) => step(value), text)),
    })
    .end();

  try {
    const result = bag.resolve('pipeline')('  DI  ');
    if (result !== 'Hello, DI!') throw new Error(`Unexpected pipeline result: ${result}`);
    const operations = bag.resolveAll(steps);
    if (operations.length !== 3 || !Object.isFrozen(operations)) {
      throw new Error('The pipeline must expose three ordered, immutable entries');
    }
    console.log(result);
  } finally {
    await bag.close();
  }
}

void main().catch(error => { console.error(error); process.exitCode = 1; });
