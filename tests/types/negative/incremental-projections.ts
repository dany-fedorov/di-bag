import { DiBag } from '../../../src';

// diagnostic: provided service does not satisfy its consumer dependency
DiBag.createBuilder().withServices({ read: ({ value }: { value: number }) => value }).withServices({ value: () => 'wrong' });

// diagnostic: provided service does not satisfy its consumer dependency
DiBag.createBuilder().withServices({ value: () => 'wrong' }).withServices({ read: ({ value }: { value: number }) => value });

const graph = DiBag.createBuilder().withServices({
  value: () => 1,
  a: ({ value }: { value: number }) => value,
  b: ({ value }: { value: number }) => value,
});

// diagnostic: provided service does not satisfy its consumer dependency
graph.withServices({ later: ({ value }: { value: string }) => value });

const key = Symbol('projection-boundary');
const token = DiBag.createToken(key).forService<number>();
const wider = DiBag.createToken(key).forService<number | string>();

// diagnostic: token dependency has an incompatible or opaque contract
DiBag.createBuilder().withServices({ unrelated: () => true }).withTokenService(token, () => 1).withServices({ read: DiBag.createProviderFromFunction({ dependencies: [wider], factoryFunction: value => value }) });

// diagnostic: token dependency has an incompatible or opaque contract
DiBag.createBuilder().withServices({ read: DiBag.createProviderFromFunction({ dependencies: [wider], factoryFunction: value => value }) }).withServices({ unrelated: () => true }).withTokenService(token, () => 1);
